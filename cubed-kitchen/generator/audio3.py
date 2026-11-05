import json, numpy as np, wave
from scipy.signal import butter, sosfilt

SR = 48000
sim = json.load(open('sim.json'))
DUR = sim['dur']; N = int(DUR * SR) + SR
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(11)
def filt(x, kind, f): return sosfilt(butter(2, f, btype=kind, fs=SR, output='sos'), x)
def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-5)) * np.exp(-t / d)
def add(sig, t, g=1.0, pan=0.0):
    i = int(t * SR)
    if i < 0 or i >= N: return
    sig = sig[:N - i]
    L[i:i + len(sig)] += sig * g * np.cos((pan + 1) * np.pi / 4) * 1.41
    R[i:i + len(sig)] += sig * g * np.sin((pan + 1) * np.pi / 4) * 1.41

def tick():  # small juicy cube hitting wood / other cubes
    n = int(0.04 * SR); t = np.arange(n) / SR
    f = rng.uniform(2200, 6500)
    click = filt(rng.standard_normal(n), 'band', [f * 0.6, min(f * 1.7, 20000)]) * env(n, 0.0002, 0.003)
    body = np.sin(2 * np.pi * rng.uniform(350, 700) * t) * env(n, 0.0005, 0.007) * 0.45
    wet = filt(rng.standard_normal(n), 'band', [600, 2000]) * env(n, 0.001, 0.008) * 0.35
    return click + body + wet
TICKS = [tick() for _ in range(60)]

def slice_snd():
    n = int(0.22 * SR)
    sh = filt(rng.standard_normal(n), 'band', [2500, 9000]) * np.sin(np.linspace(0, np.pi, n)) ** 1.5 * 0.5
    crunch = np.zeros(n)
    for p in rng.integers(0, n - 300, 50):
        crunch[p:p + 200] += rng.standard_normal(200) * np.exp(-np.arange(200) / (SR * 0.0008)) * rng.uniform(.2, 1)
    return sh + filt(crunch, 'band', [1500, 8000]) * 0.5

imp = sim['impacts']
ms = np.array([e['m'] for e in imp])
ref = np.percentile(ms, 95)
# group impacts per collider in short windows so one landing = one click
last = {}
for e in imp:
    c, t = e['c'], e['t']
    if c in last and t - last[c] < 0.06: continue
    last[c] = t
    g = min(1.0, (e['m'] / ref) ** 0.5)
    if g < 0.08: continue
    add(TICKS[rng.integers(len(TICKS))], t, g * 0.5, rng.uniform(-.8, .8))

def chop():  # juicy crunch through the orange + wooden board tock
    n = int(0.25 * SR); t = np.arange(n) / SR
    crack = np.zeros(n)
    for p in rng.integers(0, int(0.07 * SR), 60):
        crack[p:p + 200] += rng.standard_normal(200) * np.exp(-np.arange(200) / (SR * 0.0009)) * rng.uniform(.2, 1)
    crack = filt(crack, 'band', [1500, 8000]) * 0.7
    juice = filt(rng.standard_normal(n), 'band', [250, 1400]) * env(n, 0.004, 0.05) * 0.8
    tock = np.sin(2 * np.pi * rng.uniform(170, 200) * t) * env(n, 0.0008, 0.035) * 1.2
    knock = filt(rng.standard_normal(n), 'band', [800, 2600]) * env(n, 0.0004, 0.012) * 1.3
    x = crack + juice
    off = int(0.07 * SR)
    x[off:] += (tock + knock)[:n - off]
    return x
KN, KT0, KDT = sim['KN'], sim['KT0'], sim['KDT']
for i in range(1, KN + 1):
    add(chop(), KT0 + i * KDT - 0.07, 0.75, rng.uniform(-.15, .15))
mix = np.stack([L, R], 1)[:int(DUR * SR)]
mix = np.tanh(mix / np.abs(mix).max() * 1.5) / np.tanh(1.5) * 0.9
f = int(0.02 * SR); mix[:f] *= np.linspace(0, 1, f)[:, None]; mix[-int(0.15 * SR):] *= np.linspace(1, 0, int(0.15 * SR))[:, None]
w = wave.open('audio3.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((mix * 32767).astype(np.int16).tobytes()); w.close()
print('ok', len(imp))
