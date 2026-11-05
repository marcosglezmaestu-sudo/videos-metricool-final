"""ASMR sound track from the render log. usage: python3 audio.py <jobdir>  -> jobdir/final.wav (hook + main)"""
import json, sys, numpy as np, wave
from scipy.signal import butter, sosfilt
job = sys.argv[1]
log = json.load(open(f'{job}/audio.json'))
SR = 48000; TOTAL = log['total']; N = int(TOTAL * SR) + SR
L = np.zeros(N); R = np.zeros(N); rng = np.random.default_rng(5)
def filt(x, kind, f): return sosfilt(butter(2, f, btype=kind, fs=SR, output='sos'), x)
def env(n, a, d):
    t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-5)) * np.exp(-t / d)
def add(sig, t, g=1.0, pan=0.0):
    i = int(t * SR)
    if i < 0 or i >= N: return
    sig = sig[:N - i]
    L[i:i + len(sig)] += sig * g * np.cos((pan + 1) * np.pi / 4) * 1.41
    R[i:i + len(sig)] += sig * g * np.sin((pan + 1) * np.pi / 4) * 1.41
def mk_chop():
    n = int(0.25 * SR); t = np.arange(n) / SR; crack = np.zeros(n)
    for p in rng.integers(0, int(0.06 * SR), 50):
        crack[p:p + 200] += rng.standard_normal(200) * np.exp(-np.arange(200) / (SR * 0.0009)) * rng.uniform(.2, 1)
    x = filt(crack, 'band', [1500, 8000]) * 0.7 + filt(rng.standard_normal(n), 'band', [250, 1400]) * env(n, 0.004, 0.045) * 0.8
    off = int(rng.uniform(0.05, 0.07) * SR)
    x[off:] += (filt(rng.standard_normal(n), 'band', [900, 3200]) * env(n, 0.0004, 0.010) * 1.4)[:n - off]
    return x
def mk_slice():
    n = int(0.2 * SR)
    return filt(rng.standard_normal(n), 'band', [2500, 9000]) * np.sin(np.linspace(0, np.pi, n)) ** 1.5 * 0.55 + filt(rng.standard_normal(n), 'band', [300, 1500]) * env(n, 0.01, 0.05) * 0.5
def mk_tick():
    n = int(0.04 * SR); t = np.arange(n) / SR; f = rng.uniform(2200, 6500)
    return (filt(rng.standard_normal(n), 'band', [f * 0.6, min(f * 1.7, 20000)]) * env(n, 0.0002, 0.003)
            + filt(rng.standard_normal(n), 'band', [600, 2000]) * env(n, 0.001, 0.008) * 0.35)
def mk_chunk():
    n = int(0.25 * SR); t = np.arange(n) / SR
    return filt(rng.standard_normal(n), 'band', [500, 3000]) * env(n, 0.0005, 0.018) * 1.3
CH = [mk_chop() for _ in range(24)]; SL = [mk_slice() for _ in range(16)]; TK = [mk_tick() for _ in range(60)]; CK = [mk_chunk() for _ in range(12)]
pick = lambda a: a[rng.integers(len(a))]
# knife
for e in log['cuts']:
    dt = e['dt']; g = float(np.clip((dt / 0.25) ** 0.6, 0.12, 1.0)); pan = rng.uniform(-.2, .2)
    if e['set'] == 1:
        s = pick(SL); s = s[:int(max(dt * 2.5, 0.04) * SR)] if dt < 0.06 else s; add(s, e['t'] - 0.08, g * 0.9, pan)
    else:
        s = pick(CH)
        if dt < 0.06: k = int(max(dt * 2.2, 0.03) * SR); s = s[:k] * np.linspace(1, 0, len(s[:k]))
        add(s, e['t'] - 0.06, g, pan)
# rigid rounds: one click per real collision
for rd in log['rigid']:
    imp = rd['impacts']
    if not imp: continue
    ref = np.percentile([m for _, m in imp], 95)
    for t, m in imp:
        gg = min(1.0, (m / ref) ** 0.5)
        if gg < 0.08: continue
        add(pick(TK), t, gg * 0.5, rng.uniform(-.8, .8))
        if rd['round'] == 0 and gg > 0.4: add(pick(CK), t, gg * 0.35, rng.uniform(-.5, .5))
# grain rounds: clicks following the real impacts + sand hiss
gl = np.array(log['grains']) if log['grains'] else np.zeros((0, 3))
if len(gl):
    cmax = max(1.0, np.percentile(gl[:, 1], 98))
    for t, c, en in gl:
        k = int(min(28, c / cmax * 28))
        for _ in range(k): add(pick(TK), t + rng.uniform(0, 1 / 30), rng.uniform(.15, .45), rng.uniform(-.85, .85))
    n = N; dens = np.interp(np.arange(n) / SR, gl[:, 0], np.clip(gl[:, 1] / cmax, 0, 1))
    hiss = filt(rng.standard_normal(n), 'band', [1800, 11000]) * dens ** 0.7 * 0.22
mix = np.stack([L, R], 1)[:int(TOTAL * SR)]
mix = np.stack([filt(mix[:, 0], 'high', 150), filt(mix[:, 1], 'high', 150)], 1)
# leveler (steady loudness like the reference)
win = int(0.05 * SR); mono = np.abs(mix).mean(1); nw = len(mono) // win
rms = np.sqrt((mono[:nw * win].reshape(nw, win) ** 2).mean(1)) + 1e-6
k = 7; sm = np.convolve(np.pad(rms, (k, k), mode='edge'), np.ones(2 * k + 1) / (2 * k + 1), mode='valid')
tg = np.percentile(sm, 70); gain = np.clip(tg / sm, 0.5, 2.0); gain[sm < tg * 0.02] = 1.0
gs = np.repeat(gain, win); gs = np.concatenate([gs, np.full(len(mono) - len(gs), gs[-1])]); gs = np.convolve(gs, np.ones(win) / win, mode='same')
mix = mix * gs[:, None]; mix = np.tanh(mix / np.abs(mix).max() * 1.8) / np.tanh(1.8) * 0.92
h0, hl = log['hook']; hook = mix[int(h0 * SR):int((h0 + hl) * SR)].copy()
f = int(0.01 * SR); hook[-f:] *= np.linspace(1, 0.6, f)[:, None]
final = np.concatenate([hook, mix]); final[-int(0.1 * SR):] *= np.linspace(1, 0, int(0.1 * SR))[:, None]
w = wave.open(f'{job}/final.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((final * 32767).astype(np.int16).tobytes()); w.close()
print('audio ok', round(len(final) / SR, 2), 's')
