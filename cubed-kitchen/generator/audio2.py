import json, sys, numpy as np, wave
from scipy.signal import butter, sosfilt

SR = 48000
ev = json.load(open(sys.argv[1]))
TOTAL = ev['total']; N = int(TOTAL * SR) + SR
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)

def filt(x, kind, f, order=2): return sosfilt(butter(order, f, btype=kind, fs=SR, output='sos'), x)
def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-5)) * np.exp(-t / d)
def add(sig, t, g=1.0, pan=0.0):
    i = int(t * SR)
    if i < 0 or i >= N: return
    sig = sig[:N - i]
    L[i:i + len(sig)] += sig * g * np.cos((pan + 1) * np.pi / 4) * 1.41
    R[i:i + len(sig)] += sig * g * np.sin((pan + 1) * np.pi / 4) * 1.41

# --- pre-baked variations (fast) ---
def mk_chop():
    # juicy crunch through the orange + wooden board tock
    n = int(0.22 * SR); t = np.arange(n) / SR
    crack = np.zeros(n)
    for p in rng.integers(0, int(0.05 * SR), 40):
        g = rng.standard_normal(200) * np.exp(-np.arange(200) / (SR * 0.0009)) * rng.uniform(.2, 1)
        crack[p:p + 200] += g
    crack = filt(crack, 'band', [1500, 8000]) * 0.8
    juice = filt(rng.standard_normal(n), 'band', [250, 1400]) * env(n, 0.002, 0.035) * 0.9
    tock = np.sin(2 * np.pi * rng.uniform(170, 210) * t) * env(n, 0.0008, 0.03) * 1.1
    knock = filt(rng.standard_normal(n), 'band', [800, 2600]) * env(n, 0.0004, 0.012) * 1.2
    x = crack + juice
    off = int(rng.uniform(0.035, 0.05) * SR)   # board hit slightly after the cut-through
    x[off:] += (tock + knock)[:n - off]
    return x
def mk_slice():
    n = int(0.18 * SR); t = np.arange(n) / SR
    sh = filt(rng.standard_normal(n), 'band', [2500, 9000]) * np.sin(np.linspace(0, np.pi, n)) ** 1.5 * 0.55
    juice = filt(rng.standard_normal(n), 'band', [300, 1500]) * env(n, 0.01, 0.05) * 0.6
    return sh + juice
def mk_tick():
    n = int(0.025 * SR)
    f = rng.uniform(2500, 7000)
    return filt(rng.standard_normal(n), 'band', [f * 0.6, min(f * 1.6, 20000)]) * env(n, 0.0002, 0.003)
def mk_chunk():
    n = int(0.25 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * rng.uniform(110, 150) * t) * env(n, 0.001, 0.05) +
            filt(rng.standard_normal(n), 'band', [400, 2500]) * env(n, 0.0005, 0.02) * 1.3 +
            filt(rng.standard_normal(n), 'band', [2000, 8000]) * env(n, 0.0005, 0.006) * 0.6)
CHOPS = [mk_chop() for _ in range(24)]; SLICES = [mk_slice() for _ in range(16)]
TICKS = [mk_tick() for _ in range(40)]; CHUNKS = [mk_chunk() for _ in range(12)]
pick = lambda arr: arr[rng.integers(len(arr))]

for e in ev['events']:
    if e['type'] == 'cut':
        dt = e['dt']
        g = float(np.clip((dt / 0.25) ** 0.6, 0.12, 1.0))
        pan = rng.uniform(-.2, .2)
        if e['set'] < 2:
            s = pick(CHOPS)
            if dt < 0.05: s = s[:int(max(dt * 2.2, 0.03) * SR)] * np.linspace(1, 0, int(max(dt * 2.2, 0.03) * SR))[:len(s[:int(max(dt * 2.2, 0.03) * SR)])]
            add(s, e['t'] - 0.03, g, pan)
        else:
            s = pick(SLICES)
            if dt < 0.05: s = s[:int(max(dt * 2.5, 0.04) * SR)]
            add(s, e['t'] - 0.07, g * 0.9, pan)
    elif e['type'] == 'lands':
        times = np.array(e['times']); total = e['total']
        if total <= 100:          # big chunks
            for t in times: add(pick(CHUNKS), t, 0.3, rng.uniform(-.5, .5))
        elif total <= 5000:       # small cubes: crisp clicks
            for t in times:
                p = rng.uniform(-.7, .7); add(pick(TICKS), t, 0.5, p); add(pick(CHUNKS)[:1500], t, 0.08, p)
        else:                     # grains: dense pour = clicks + sand hiss following landing density
            w = total / max(1, len(times))
            for t in times: add(pick(TICKS), t, 0.32, rng.uniform(-.8, .8))
            if len(times):
                t0, t1 = times.min(), times.max() + 0.1
                n = int((t1 - t0) * SR)
                hist, edges = np.histogram(times, bins=max(2, int((t1 - t0) / 0.02)), range=(t0, t1))
                dens = np.interp(np.arange(n) / SR, (edges[:-1] + edges[1:]) / 2 - t0, hist / max(1, hist.max()))
                hiss = filt(rng.standard_normal(n), 'band', [1800, 11000]) * dens ** 0.7 * 0.35
                grit = filt(rng.standard_normal(n) * (rng.random(n) < 0.02), 'high', 3000) * dens * 0.9
                add(hiss + grit, t0, 1.0)

mix = np.stack([L, R], 1)[:int(TOTAL * SR)]
# leveler: keep a steady, full loudness like the reference (slow RMS follower)
win = int(0.05 * SR)
mono = np.abs(mix).mean(1)
nwin = len(mono) // win
rms = np.sqrt((mono[:nwin * win].reshape(nwin, win) ** 2).mean(1)) + 1e-6
k = 7; sm = np.convolve(np.pad(rms, (k, k), mode='edge'), np.ones(2 * k + 1) / (2 * k + 1), mode='valid')
target = np.percentile(sm, 70)
gain = np.clip(target / sm, 0.4, 6.0)
gain[sm < target * 0.02] = 1.0   # leave true silences alone
gs = np.repeat(gain, win); gs = np.concatenate([gs, np.full(len(mono) - len(gs), gs[-1])])
gs = np.convolve(gs, np.ones(win) / win, mode='same')
mix = mix * gs[:, None]
peak = np.abs(mix).max()
mix = np.tanh(mix / peak * 1.8) / np.tanh(1.8) * 0.92
f = int(0.03 * SR); mix[:f] *= np.linspace(0, 1, f)[:, None]; mix[-f:] *= np.linspace(1, 0, f)[:, None]
w = wave.open(sys.argv[2], 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((mix * 32767).astype(np.int16).tobytes()); w.close()
print('ok')
