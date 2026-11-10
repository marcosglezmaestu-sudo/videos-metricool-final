"""Build an IFM long-form video from a project file.
Usage: python3 build.py projects/ifm03.py OUTDIR [--tts] [--render] [--preview N]
"""
import sys, os, json, math, importlib.util, subprocess, copy, re
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 24000
FPS = 30
LEAD = 0.06          # silence before narration in each scene (faster pace, nov 2026)
DEFAULT_PAUSE = 0.18 # gap after each beat (faster pace requested nov 2026)

def load_project(path):
    spec = importlib.util.spec_from_file_location('proj', path)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    return m

# ---------------------------------------------------------------- TTS
def trim(a, thr=0.008):
    idx = np.where(np.abs(a) > thr)[0]
    if len(idx) == 0: return a[:0]
    s = max(0, idx[0] - int(0.02 * SR)); e = min(len(a), idx[-1] + int(0.06 * SR))
    return a[s:e]

def tts(proj, out):
    from kokoro_onnx import Kokoro
    k = Kokoro(os.path.join(os.path.dirname(HERE), 'tts', 'kokoro-v1.0.onnx'),
               os.path.join(os.path.dirname(HERE), 'tts', 'voices-v1.0.bin'))
    os.makedirs(os.path.join(out, 'vo'), exist_ok=True)
    meta = []
    for i, b in enumerate(proj.BEATS):
        fn = os.path.join(out, 'vo', f'{i:03d}.wav')
        if b['text'].strip():
            if not os.path.exists(fn):
                a, sr = k.create(b['text'], voice=getattr(proj, 'VOICE', 'bm_fable'), speed=getattr(proj, 'SPEED', 1.0),
                                 lang=getattr(proj, 'LANG', 'en-gb'))
                a = trim(a.astype(np.float32))
                sf.write(fn, a, sr)
            a, _ = sf.read(fn)
            meta.append(dict(i=i, dur=len(a) / SR, words=len(b['text'].split())))
        else:
            meta.append(dict(i=i, dur=0.0, words=0))
        print(f'tts {i:03d} {meta[-1]["dur"]:.2f}s', flush=True)
    json.dump(meta, open(os.path.join(out, 'vo.json'), 'w'))
    return meta

# ---------------------------------------------------------------- timeline
def kw_time(text, kw, speech):
    """Estimate when keyword is spoken: proportional to character offset."""
    pos = text.lower().find(kw.lower())
    if pos < 0:
        raise ValueError(f'keyword {kw!r} not in: {text}')
    return LEAD + speech * (pos / max(1, len(text))) - 0.05

def resolve(obj, text, speech, events):
    if isinstance(obj, dict):
        out = {}
        for k_, v in obj.items():
            if (k_ == 'at' or k_.endswith('_at')) and isinstance(v, str):
                # never let an element wait until the very end of the sentence
                v = min(kw_time(text, v, speech), LEAD + 0.62 * speech)
            elif (k_ == 'at' or k_.endswith('_at')) and isinstance(v, (int, float)):
                v = float(v)
            out[k_] = resolve(v, text, speech, events) if isinstance(v, (dict, list, tuple)) else v
            if k_ == 'at':
                events.append(out[k_])
        # map highlight dict values (colour, at)
        if 'hl' in out and isinstance(out['hl'], dict):
            nh = {}
            for name, val in out['hl'].items():
                if isinstance(val, (list, tuple)):
                    col, a_ = val
                    if isinstance(a_, str): a_ = min(kw_time(text, a_, speech), LEAD + 0.62 * speech)
                    nh[name] = (col, float(a_)); events.append(float(a_))
            out['hl'] = nh
        return out
    if isinstance(obj, list):
        return [resolve(x, text, speech, events) for x in obj]
    if isinstance(obj, tuple):
        return tuple(resolve(x, text, speech, events) for x in obj)
    return obj

def timeline(proj, meta):
    scenes = []; cur = 0.0
    for b, m in zip(proj.BEATS, meta):
        speech = m['dur']
        d = LEAD + speech + b.get('pause', DEFAULT_PAUSE)
        events = []
        sp = resolve(copy.deepcopy(b['scene']), b['text'], speech, events)
        # something must be on screen almost immediately: the earliest element appears by 0.3 s
        holders = []
        def walk(o):
            if isinstance(o, dict):
                if isinstance(o.get('at'), float): holders.append(o)
                for v in o.values(): walk(v)
            elif isinstance(o, (list, tuple)):
                for v in o: walk(v)
        walk(sp)
        if holders:
            first = min(holders, key=lambda h: h['at'])
            if first['at'] > 0.3:
                first['at'] = 0.3; events.append(0.3)
        words = []
        if speech > 0:
            toks = b['text'].split(); tot = sum(len(w_) + 1 for w_ in toks); cpos = 0
            for w_ in toks:
                a0 = cur + LEAD + speech * cpos / tot; cpos += len(w_) + 1
                words.append((w_.strip('"'), a0, cur + LEAD + speech * cpos / tot))
        chunks = []
        for k in range(0, len(words), 3):
            grp = words[k:k + 3]
            chunks.append(dict(t0=grp[0][1], t1=grp[-1][2] if k + 3 < len(words) else cur + d, words=grp))
        scenes.append(dict(start=cur, dur=d, spec=sp, vo=m['i'] if speech > 0 else None, chunks=chunks,
                           sfx=b.get('sfx'), pops=sorted(set(round(e, 2) for e in events if e > 0.05))))
        cur += d
    return scenes, cur

# ---------------------------------------------------------------- SFX (synthesised, quiet)
def _env(n, a=0.005, r=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / r)

def sfx_whoosh(dur=0.55):
    n = int(dur * SR); rng = np.random.default_rng(1)
    noise = rng.normal(0, 1, n)
    # band sweep via moving average of varying width
    out = np.zeros(n); win = np.linspace(40, 4, n).astype(int)
    cs = np.cumsum(np.insert(noise, 0, 0))
    for i in range(n):
        w = win[i]; j = max(0, i - w); out[i] = (cs[i + 1] - cs[j]) / (i + 1 - j)
    env = np.sin(np.linspace(0, math.pi, n)) ** 2
    return out * env * 1.6

def sfx_pop():
    n = int(0.09 * SR); t = np.arange(n) / SR
    f = 900 * np.exp(-t * 25) + 380
    return np.sin(2 * math.pi * np.cumsum(f) / SR) * _env(n, 0.002, 0.03)

def sfx_coin():
    n = int(0.5 * SR); t = np.arange(n) / SR
    return (np.sin(2 * math.pi * 2093 * t) * 0.6 + np.sin(2 * math.pi * 3136 * t) * 0.4) * _env(n, 0.002, 0.12)

def sfx_sting():
    n = int(1.8 * SR); t = np.arange(n) / SR
    chord = sum(np.sin(2 * math.pi * f * t) * a for f, a in ((220, .5), (277.2, .35), (329.6, .35), (440, .25)))
    coin = np.pad(sfx_coin(), (int(0.25 * SR), 0)); coin = np.pad(coin, (0, max(0, n - len(coin))))[:n]
    return chord * _env(n, 0.04, 0.6) * 0.8 + coin

SFX_LEVELS = {'pop': 0.035, 'whoosh': 0.06, 'coin': 0.04, 'sting': 0.07}

def build_audio(scenes, total, out):
    mix = np.zeros(int((total + 1) * SR))
    def add(sig, t0, gain):
        s = int(t0 * SR); e = min(len(mix), s + len(sig))
        if s < len(mix): mix[s:e] += sig[:e - s] * gain
    vo_dir = os.path.join(out, 'vo')
    whoosh, pop, sting = sfx_whoosh(), sfx_pop(), sfx_sting()
    for sc in scenes:
        if sc['vo'] is not None:
            a, _ = sf.read(os.path.join(vo_dir, f"{sc['vo']:03d}.wav"))
            add(a, sc['start'] + LEAD, 1.0)
        if sc['sfx'] == 'whoosh': add(whoosh, max(0, sc['start'] - 0.2), SFX_LEVELS['whoosh'])
        if sc['sfx'] == 'sting': add(sting, sc['start'], SFX_LEVELS['sting'])
        if sc['sfx'] == 'pop': add(pop, sc['start'] + 0.1, SFX_LEVELS['pop'])
        for p_ in sc['pops'][:6]:
            add(pop, sc['start'] + p_, SFX_LEVELS['pop'])
    # loudness: normalise peak, then simple RMS target around -16 LUFS-ish
    peak = np.max(np.abs(mix)) or 1
    mix = mix / peak * 0.89
    sf.write(os.path.join(out, 'mix.wav'), mix.astype(np.float32), SR)


def fmt_srt(t):
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h:02d}:{m:02d}:{int(s):02d},{int((s - int(s)) * 1000):03d}"

def write_meta(proj, scenes, out):
    """Sentence-level .srt + YouTube chapters from chapter scenes."""
    lines = []; n = 1
    for b, sc in zip(proj.BEATS, scenes):
        if not b['text'].strip(): continue
        sents = re.split(r'(?<=[.?!])\s+', b['text'].strip())
        speech = sc['dur'] - LEAD - b.get('pause', DEFAULT_PAUSE)
        tot = sum(len(s_) for s_ in sents); cur = sc['start'] + LEAD
        for s_ in sents:
            d = speech * len(s_) / tot
            lines.append(f"{n}\n{fmt_srt(cur)} --> {fmt_srt(cur + d)}\n{s_}\n"); n += 1; cur += d
    open(os.path.join(out, 'subtitles_en.srt'), 'w').write('\n'.join(lines))
    ch = ['0:00 Intro']
    for b, sc in zip(proj.BEATS, scenes):
        if sc['spec']['type'] == 'chapter':
            t = int(sc['start']); name = b['text'].rstrip('.').replace('. ', ': ')
            ch.append(f"{t // 60}:{t % 60:02d} {name}")
    open(os.path.join(out, 'chapters.txt'), 'w').write('\n'.join(ch) + '\n')

# ---------------------------------------------------------------- render
def render_range(scenes_json, f0, f1, outfile):
    sys.path.insert(0, HERE)
    import skia
    from draw import W, H
    from scenes import render_scene, draw_caption
    scenes = json.load(open(scenes_json))
    captions = H > W
    proc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', f'{W}x{H}',
                             '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
                             '-pix_fmt', 'yuv420p', outfile], stdin=subprocess.PIPE)
    surf = skia.Surface(W, H); c = surf.getCanvas()
    k = 0
    for f in range(f0, f1):
        t = f / FPS
        while k + 1 < len(scenes) and scenes[k + 1]['start'] <= t: k += 1
        while k > 0 and scenes[k]['start'] > t: k -= 1
        sc = scenes[k]
        c.save(); render_scene(c, t - sc['start'], sc['dur'], sc['spec']); c.restore()
        if captions: draw_caption(c, t, sc['chunks'])
        proc.stdin.write(surf.makeImageSnapshot().tobytes())
    proc.stdin.close(); proc.wait()

if __name__ == '__main__':
    proj_path, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    proj = load_project(proj_path)
    if getattr(proj, 'FORMAT', 'horizontal') == 'vertical':
        os.environ['IFM_FORMAT'] = 'vertical'
    if '--tts' in sys.argv or not os.path.exists(os.path.join(out, 'vo.json')):
        meta = tts(proj, out)
    meta = json.load(open(os.path.join(out, 'vo.json')))
    scenes, total = timeline(proj, meta)
    json.dump(scenes, open(os.path.join(out, 'scenes.json'), 'w'))
    words = sum(m['words'] for m in meta); speech = sum(m['dur'] for m in meta)
    print(f'TOTAL {total:.1f}s = {int(total // 60)}:{total % 60:04.1f} | scenes {len(scenes)} | speech wpm {words / speech * 60:.0f} | overall wpm {words / total * 60:.0f}')
    write_meta(proj, scenes, out)
    if '--preview' in sys.argv:
        # stills at given scene indices
        sys.path.insert(0, HERE)
        import skia
        from draw import W, H
        from scenes import render_scene
        idx = [int(x) for x in sys.argv[sys.argv.index('--preview') + 1].split(',')]
        for i in idx:
            sc = scenes[i]; surf = skia.Surface(W, H)
            render_scene(surf.getCanvas(), sc['dur'] * 0.8, sc['dur'], sc['spec'])
            if H > W:
                from scenes import draw_caption
                draw_caption(surf.getCanvas(), sc['start'] + sc['dur'] * 0.5, sc['chunks'])
            surf.makeImageSnapshot().save(os.path.join(out, f'prev_{i:03d}.png'))
    if '--render' in sys.argv:
        build_audio(scenes, total, out)
        nf = int(math.ceil(total * FPS))
        from multiprocessing import Process
        parts = int(os.environ.get('PARTS', '2'))
        step = nf // parts + 1
        procs = []
        for p in range(parts):
            f0, f1 = p * step, min(nf, (p + 1) * step)
            pr = Process(target=render_range, args=(os.path.join(out, 'scenes.json'), f0, f1, os.path.join(out, f'part{p}.mp4')))
            pr.start(); procs.append(pr)
        for pr in procs: pr.join()
        with open(os.path.join(out, 'parts.txt'), 'w') as fh:
            for p in range(parts): fh.write(f"file 'part{p}.mp4'\n")
        final = os.path.join(out, getattr(proj, 'OUTNAME', 'video') + '.mp4')
        an = subprocess.run(['ffmpeg', '-hide_banner', '-i', os.path.join(out, 'mix.wav'), '-af',
                             'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
        js = json.loads(an[an.rindex('{'):an.rindex('}') + 1])
        ln = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:"
              f"measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', os.path.join(out, 'parts.txt'),
                        '-i', os.path.join(out, 'mix.wav'), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
                        '-af', ln, '-shortest', '-movflags', '+faststart', final], check=True)
        print('DONE', final)
