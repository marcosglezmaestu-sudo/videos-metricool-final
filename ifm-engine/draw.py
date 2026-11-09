"""Drawing primitives for the IFM infographic engine (skia, 1920x1080)."""
import math, json, os
import numpy as np
import skia

VERTICAL = os.environ.get('IFM_FORMAT') == 'vertical'
W, H = (1080, 1920) if VERTICAL else (1920, 1080)
HERE = os.path.dirname(os.path.abspath(__file__))

# ---------- palette (Inside Football Money) ----------
def C(hexs, a=255):
    hexs = hexs.lstrip('#')
    r, g, b = int(hexs[0:2], 16), int(hexs[2:4], 16), int(hexs[4:6], 16)
    return skia.Color(r, g, b, a)

PAL = {
    'navy': '#0b1530', 'navy2': '#17264d', 'navy3': '#243a70',
    'gold': '#e8b23a', 'gold2': '#f5cf6b', 'golddk': '#a8781a',
    'green': '#5fd08a', 'green2': '#2fa866', 'greendk': '#1f6e45',
    'paper': '#f3efe6', 'paper2': '#e4ddcc', 'ink': '#121a2e',
    'red': '#e5484d', 'reddk': '#a82a2f', 'sky': '#5aa9e6', 'skydk': '#2f6fa6',
    'white': '#ffffff', 'grey': '#9aa3b5', 'teal': '#3cc1b7', 'purple': '#8c6fe0',
}
def P(name, a=255):
    return C(PAL.get(name, name), a)

# background name -> (bg, fg text colour, accent)
BG = {
    'navy':  ('navy', 'paper', 'gold'),
    'green': ('green', 'navy', 'paper'),
    'gold':  ('gold', 'navy', 'paper'),
    'paper': ('paper', 'navy', 'gold'),
    'sky':   ('sky', 'navy', 'paper'),
    'red':   ('red', 'paper', 'navy'),
}

# ---------- fonts ----------
_TF = {}
def tf(name):
    if name not in _TF:
        _TF[name] = skia.Typeface.MakeFromFile(os.path.join(HERE, 'fonts', name + '.ttf'))
    return _TF[name]
FONT_HEAD = 'Montserrat-Black'
FONT_BOLD = 'Montserrat-ExtraBold'
FONT_SEMI = 'Montserrat-Bold'
FONT_NUM = 'Anton'
FONT_BODY = 'Inter-Bold'

def font(name, size):
    f = skia.Font(tf(name), size)
    f.setEdging(skia.Font.Edging.kAntiAlias)
    f.setSubpixel(True)
    return f

# ---------- easing ----------
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))
def ease_out(x):
    x = clamp(x); return 1 - (1 - x) ** 3
def ease_in_out(x):
    x = clamp(x); return 3 * x * x - 2 * x * x * x
def ease_back(x, s=1.7):
    x = clamp(x); x -= 1; return x * x * ((s + 1) * x + s) + 1
def prog(t, start, dur=0.4):
    return clamp((t - start) / dur) if dur > 0 else (1.0 if t >= start else 0.0)
def lerp(a, b, x):
    return a + (b - a) * x

# ---------- paints ----------
def paint(color, style='fill', width=0, alpha=None, aa=True):
    p = skia.Paint(AntiAlias=aa)
    p.setColor(color)
    if alpha is not None:
        p.setAlphaf(alpha)
    if style == 'stroke':
        p.setStyle(skia.Paint.kStroke_Style); p.setStrokeWidth(width)
        p.setStrokeCap(skia.Paint.kRound_Cap); p.setStrokeJoin(skia.Paint.kRound_Join)
    return p

SHADOW = (10, 12)
def shadow_paint(alpha=0.28):
    return paint(skia.Color(5, 10, 25), alpha=alpha)

# ---------- text ----------
def text_w(s, f):
    return f.measureText(s)

def draw_text(c, s, x, y, f, color, align='center', alpha=1.0, shadow=False, outline=None):
    w = text_w(s, f)
    if align == 'center': x0 = x - w / 2
    elif align == 'right': x0 = x - w
    else: x0 = x
    blob = skia.TextBlob.MakeFromString(s, f)
    if blob is None: return w
    if shadow:
        c.drawTextBlob(blob, x0 + 5, y + 6, shadow_paint(0.35 * alpha))
    if outline:
        op = paint(outline[0], 'stroke', outline[1], alpha=alpha)
        c.drawTextBlob(blob, x0, y, op)
    c.drawTextBlob(blob, x0, y, paint(color, alpha=alpha))
    return w

def wrap(s, f, maxw):
    words = s.split(' '); lines = []; cur = ''
    for w_ in words:
        t = (cur + ' ' + w_).strip()
        if text_w(t, f) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur); cur = w_
    if cur: lines.append(cur)
    return lines

def fit_font(s, name, size, maxw, minsize=20):
    while size > minsize and text_w(s, font(name, size)) > maxw:
        size -= 2
    return font(name, size)

def draw_lines(c, lines, x, y, f, color, lh=1.15, align='center', alpha=1.0, shadow=False,
               highlight=None, hl_color=None):
    """Draw lines; words in `highlight` set are coloured hl_color."""
    size = f.getSize()
    for i, ln in enumerate(lines):
        yy = y + i * size * lh
        if highlight:
            # word by word
            words = ln.split(' ')
            total = text_w(ln, f)
            xx = x - total / 2 if align == 'center' else x
            for wd in words:
                key = wd.strip('?,.!:;"').upper()
                col = hl_color if key in highlight else color
                ww = draw_text(c, wd, xx, yy, f, col, 'left', alpha, shadow)
                xx += ww + text_w(' ', f)
        else:
            draw_text(c, ln, x, yy, f, color, align, alpha, shadow)

# ---------- shapes ----------
def rrect(c, x, y, w, h, r, color, alpha=1.0, shadow=False, stroke=None):
    rr = skia.RRect.MakeRectXY(skia.Rect.MakeXYWH(x, y, w, h), r, r)
    if shadow:
        c.drawRRect(skia.RRect.MakeRectXY(skia.Rect.MakeXYWH(x + SHADOW[0], y + SHADOW[1], w, h), r, r),
                    shadow_paint(0.28 * alpha))
    c.drawRRect(rr, paint(color, alpha=alpha))
    if stroke:
        c.drawRRect(rr, paint(stroke[0], 'stroke', stroke[1], alpha=alpha))

def circle(c, x, y, r, color, alpha=1.0, shadow=False, stroke=None):
    if shadow:
        c.drawCircle(x + SHADOW[0] * 0.7, y + SHADOW[1] * 0.7, r, shadow_paint(0.28 * alpha))
    c.drawCircle(x, y, r, paint(color, alpha=alpha))
    if stroke:
        c.drawCircle(x, y, r, paint(stroke[0], 'stroke', stroke[1], alpha=alpha))

def path_from(points, close=True):
    p = skia.Path()
    p.moveTo(*points[0])
    for pt in points[1:]:
        p.lineTo(*pt)
    if close: p.close()
    return p

def poly(c, points, color, alpha=1.0, shadow=False, stroke=None):
    p = path_from(points)
    if shadow:
        c.save(); c.translate(*SHADOW); c.drawPath(p, shadow_paint(0.28 * alpha)); c.restore()
    c.drawPath(p, paint(color, alpha=alpha))
    if stroke:
        c.drawPath(p, paint(stroke[0], 'stroke', stroke[1], alpha=alpha))

def line(c, x1, y1, x2, y2, color, w=6, alpha=1.0, dash=None):
    p = paint(color, 'stroke', w, alpha=alpha)
    if dash:
        p.setPathEffect(skia.DashPathEffect.Make(dash, 0))
    c.drawLine(x1, y1, x2, y2, p)

def arrow(c, x1, y1, x2, y2, color, w=10, head=30, alpha=1.0, progress=1.0, curve=0.0, dash=None):
    """Curved arrow drawn up to `progress`."""
    if progress <= 0: return
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    dx, dy = x2 - x1, y2 - y1
    cx, cy = mx - dy * curve, my + dx * curve
    n = 40; pts = []
    for i in range(n + 1):
        u = i / n * progress
        px = (1 - u) ** 2 * x1 + 2 * (1 - u) * u * cx + u * u * x2
        py = (1 - u) ** 2 * y1 + 2 * (1 - u) * u * cy + u * u * y2
        pts.append((px, py))
    p = path_from(pts, close=False)
    pa = paint(color, 'stroke', w, alpha=alpha)
    if dash: pa.setPathEffect(skia.DashPathEffect.Make(dash, 0))
    c.drawPath(p, pa)
    if progress > 0.95 and len(pts) > 2:
        (ax, ay), (bx, by) = pts[-3], pts[-1]
        ang = math.atan2(by - ay, bx - ax)
        h1 = (bx - head * math.cos(ang - 0.45), by - head * math.sin(ang - 0.45))
        h2 = (bx - head * math.cos(ang + 0.45), by - head * math.sin(ang + 0.45))
        poly(c, [(bx + math.cos(ang) * 6, by + math.sin(ang) * 6), h1, h2], color, alpha)

def pop_scale(c, x, y, p, overshoot=True):
    """Apply a pop-in scale transform around (x,y). Caller must save/restore."""
    s = ease_back(p) if overshoot else ease_out(p)
    c.translate(x, y); c.scale(max(s, 0.001), max(s, 0.001)); c.translate(-x, -y)

# ---------- background / texture ----------
_GRAIN = None
def grain_image():
    global _GRAIN
    if _GRAIN is None:
        rng = np.random.default_rng(7)
        n = rng.normal(0, 1, (H // 2, W // 2))
        # paper fibres: blur-ish by averaging shifted copies
        n = (n + np.roll(n, 1, 0) + np.roll(n, 1, 1) + np.roll(n, -1, 1)) / 4
        a = np.clip(np.abs(n) * 22, 0, 40).astype(np.uint8)
        v = np.where(n > 0, 255, 0).astype(np.uint8)
        rgba = np.dstack([v, v, v, a])
        rgba = np.ascontiguousarray(np.repeat(np.repeat(rgba, 2, 0), 2, 1))
        _GRAIN = skia.Image.fromarray(rgba, colorType=skia.ColorType.kRGBA_8888_ColorType)
    return _GRAIN

def background(c, name):
    bg = BG.get(name, BG['navy'])[0]
    c.clear(P(bg))
    # soft radial light in the middle (Tifo-like)
    sh = skia.GradientShader.MakeRadial((W / 2, H * 0.45), W * 0.75,
                                       [skia.Color(255, 255, 255, 38), skia.Color(0, 0, 0, 40)])
    p = skia.Paint(Shader=sh); c.drawRect(skia.Rect.MakeWH(W, H), p)

def overlay_grain(c, alpha=0.55):
    p = skia.Paint(); p.setAlphaf(alpha)
    c.drawImage(grain_image(), 0, 0, skia.SamplingOptions(), p)

def watermark(c, alpha=0.55):
    # IFM monogram, top-right, away from YouTube UI
    x, y = (60, 170) if VERTICAL else (W - 150, 46)
    rrect(c, x, y, 104, 46, 10, P('navy'), alpha * 0.85, stroke=(P('gold'), 2))
    draw_text(c, 'IFM', x + 52, y + 33, font(FONT_HEAD, 27), P('gold'), alpha=min(1, alpha + 0.3))

# ---------- world map ----------
_WORLD = None
def world():
    global _WORLD
    if _WORLD is None:
        _WORLD = json.load(open(os.path.join(HERE, 'world.json')))
    return _WORLD

def proj(lon, lat, box):
    """Equirectangular projection into box=(x,y,w,h, lon0, lon1, lat0, lat1)."""
    x, y, w, h, lo0, lo1, la0, la1 = box
    return x + (lon - lo0) / (lo1 - lo0) * w, y + (la1 - lat) / (la1 - la0) * h

def draw_world(c, box, base, hl=None, alpha=1.0, outline='navy'):
    hl = hl or {}
    for name, polys in world().items():
        col = hl.get(name, base)
        for poly_ in polys:
            p = skia.Path()
            for ring in poly_:
                pts = [proj(lo, la, box) for lo, la in ring]
                p.moveTo(*pts[0])
                for q in pts[1:]: p.lineTo(*q)
                p.close()
            p.setFillType(skia.PathFillType.kEvenOdd)
            c.drawPath(p, paint(P(col), alpha=alpha))
            c.drawPath(p, paint(P(outline), 'stroke', 1.4, alpha=alpha * 0.6))
