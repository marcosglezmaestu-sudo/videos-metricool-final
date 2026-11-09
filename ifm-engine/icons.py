"""Flat 2D icons drawn in code. Each: fn(c, x, y, s, **kw), centred at (x, y), s ~ icon height."""
import math
import skia
from draw import *

OUT = 'navy'          # outline colour
def ow(s): return max(3, s * 0.03)

def shirt(c, x, y, s, color='red', trim='white', text=None, number=None, text_color='white', back=True):
    w = s * 1.05
    pts = [(-0.22, -0.5), (-0.5, -0.36), (-0.62, -0.08), (-0.42, 0.02), (-0.36, -0.08),
           (-0.36, 0.5), (0.36, 0.5), (0.36, -0.08), (0.42, 0.02), (0.62, -0.08),
           (0.5, -0.36), (0.22, -0.5), (0.0, -0.44)]
    P_ = [(x + px * w, y + py * s) for px, py in pts]
    poly(c, P_, P(color), shadow=True, stroke=(P(OUT), ow(s)))
    # collar
    col = [(x - 0.22 * w, y - 0.5 * s), (x, y - 0.42 * s), (x + 0.22 * w, y - 0.5 * s)]
    c.drawPath(path_from(col, False), paint(P(trim), 'stroke', s * 0.045))
    # sleeve cuffs
    for sg in (-1, 1):
        line(c, x + sg * 0.62 * w, y - 0.08 * s, x + sg * 0.42 * w, y + 0.02 * s, P(trim), s * 0.04)
    if text:
        f = fit_font(text, FONT_HEAD, int(s * 0.13), w * 0.62)
        draw_text(c, text, x, y - 0.18 * s, f, P(text_color))
    if number is not None:
        f = fit_font(str(number), FONT_NUM, int(s * 0.42), w * 0.62)
        draw_text(c, str(number), x, y + 0.32 * s, f, P(text_color), outline=(P(OUT), s * 0.012))

def coin(c, x, y, s, color='gold', sym='£'):
    r = s / 2
    circle(c, x, y, r, P('golddk'), shadow=True)
    circle(c, x, y - r * 0.08, r, P(color), stroke=(P(OUT), ow(s) * 1.2))
    circle(c, x, y - r * 0.08, r * 0.72, P('gold2'))
    draw_text(c, sym, x, y + r * 0.3, font(FONT_HEAD, int(s * 0.62)), P('golddk'))

def coin_stack(c, x, y, s, n=4):
    for i in range(n):
        yy = y + s * 0.3 - i * s * 0.16
        rrect(c, x - s * 0.45, yy - s * 0.09, s * 0.9, s * 0.18, s * 0.09, P('gold'),
              shadow=(i == 0), stroke=(P(OUT), ow(s)))
        line(c, x - s * 0.3, yy, x + s * 0.3, yy, P('golddk'), s * 0.02)

def banknote(c, x, y, s, color='green', sym='£', angle=0):
    c.save(); c.translate(x, y); c.rotate(angle)
    w, h = s * 1.6, s * 0.8
    rrect(c, -w / 2, -h / 2, w, h, s * 0.06, P(color), shadow=True, stroke=(P(OUT), ow(s)))
    rrect(c, -w / 2 + s * 0.08, -h / 2 + s * 0.08, w - s * 0.16, h - s * 0.16, s * 0.04,
          P('greendk'), alpha=0.25)
    circle(c, 0, 0, h * 0.28, P('paper'), stroke=(P(OUT), ow(s) * 0.7))
    draw_text(c, sym, 0, h * 0.13, font(FONT_HEAD, int(h * 0.38)), P('greendk'))
    c.restore()

def stadium(c, x, y, s, color='navy2', roof='paper', pitch='green2', lights=True, seats='skydk'):
    """Aerial stadium: roof ring, seat bowl, pitch."""
    w, h = s * 2.3, s * 1.25
    outer = skia.Rect.MakeXYWH(x - w / 2, y - h / 2, w, h)
    c.drawOval(outer.makeOffset(SHADOW[0], SHADOW[1]), shadow_paint(0.3))
    c.drawOval(outer, paint(P(roof)))
    c.drawOval(outer, paint(P(OUT), 'stroke', ow(s)))
    mid = skia.Rect.MakeXYWH(x - w * 0.42, y - h * 0.4, w * 0.84, h * 0.8)
    c.drawOval(mid, paint(P(seats)))
    # seat rows
    for k in range(1, 4):
        r = skia.Rect.MakeXYWH(x - w * (0.42 - k * 0.03), y - h * (0.4 - k * 0.035), w * (0.84 - k * 0.06), h * (0.8 - k * 0.07))
        c.drawOval(r, paint(P('navy'), 'stroke', s * 0.008, alpha=0.35))
    for i in range(24):
        a = i / 24 * math.tau
        line(c, x + math.cos(a) * w * 0.33, y + math.sin(a) * h * 0.31, x + math.cos(a) * w * 0.42,
             y + math.sin(a) * h * 0.4, P('navy'), s * 0.008, alpha=0.35)
    c.drawOval(mid, paint(P(OUT), 'stroke', ow(s) * 0.8))
    pw, ph = w * 0.5, h * 0.46
    rrect(c, x - pw / 2, y - ph / 2, pw, ph, s * 0.02, P(pitch), stroke=(P(OUT), ow(s) * 0.7))
    pp = paint(P('paper'), 'stroke', s * 0.01, alpha=0.9)
    c.drawRect(skia.Rect.MakeXYWH(x - pw / 2 + s * 0.04, y - ph / 2 + s * 0.04, pw - s * 0.08, ph - s * 0.08), pp)
    c.drawLine(x, y - ph / 2 + s * 0.04, x, y + ph / 2 - s * 0.04, pp)
    c.drawCircle(x, y, s * 0.08, pp)
    for sg in (-1, 1):
        c.drawRect(skia.Rect.MakeXYWH(x + sg * (pw / 2 - s * 0.04) - (s * 0.1 if sg > 0 else 0), y - s * 0.12, s * 0.1, s * 0.24), pp)
    if lights:
        for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
            circle(c, x + sx * w * 0.36, y + sy * h * 0.36, s * 0.05, P('gold2'), stroke=(P(OUT), ow(s) * 0.5))

def document(c, x, y, s, title='', stamp=None, stamp_color='red', lines=6, color='paper', p_stamp=1.0):
    w, h = s * 0.78, s
    rrect(c, x - w / 2, y - h / 2, w, h, s * 0.03, P(color), shadow=True, stroke=(P(OUT), ow(s)))
    if title:
        f = fit_font(title, FONT_HEAD, int(s * 0.1), w * 0.82)
        draw_text(c, title, x, y - h / 2 + s * 0.16, f, P('navy'))
    for i in range(lines):
        yy = y - h / 2 + s * 0.28 + i * s * 0.1
        ln = w * (0.7 if i % 3 == 2 else 0.8)
        line(c, x - w * 0.4, yy, x - w * 0.4 + ln, yy, P('grey'), s * 0.025)
    if stamp and p_stamp > 0:
        c.save(); c.translate(x, y + s * 0.18); c.rotate(-12)
        sc = lerp(1.6, 1.0, ease_out(p_stamp)); c.scale(sc, sc)
        f = fit_font(stamp, FONT_HEAD, int(s * 0.15), w * 0.95)
        tw = text_w(stamp, f)
        rrect(c, -tw / 2 - s * 0.05, -s * 0.13, tw + s * 0.1, s * 0.19, s * 0.03, P(stamp_color),
              alpha=0.0, stroke=(P(stamp_color), s * 0.025))
        rr = skia.RRect.MakeRectXY(skia.Rect.MakeXYWH(-tw / 2 - s * 0.05, -s * 0.13, tw + s * 0.1, s * 0.19), s * 0.03, s * 0.03)
        c.drawRRect(rr, paint(P(stamp_color), 'stroke', s * 0.025, alpha=ease_out(p_stamp)))
        draw_text(c, stamp, 0, s * 0.02, f, P(stamp_color), alpha=ease_out(p_stamp))
        c.restore()

def calendar(c, x, y, s, month='JAN', year='2005', color='red'):
    w, h = s * 0.95, s
    rrect(c, x - w / 2, y - h / 2, w, h, s * 0.1, P('paper'), shadow=True, stroke=(P(OUT), ow(s)))
    c.save()
    c.clipRRect(skia.RRect.MakeRectXY(skia.Rect.MakeXYWH(x - w / 2, y - h / 2, w, h), s * 0.1, s * 0.1))
    c.drawRect(skia.Rect.MakeXYWH(x - w / 2, y - h / 2, w, h * 0.27), paint(P(color)))
    c.restore()
    rr = skia.RRect.MakeRectXY(skia.Rect.MakeXYWH(x - w / 2, y - h / 2, w, h), s * 0.1, s * 0.1)
    c.drawRRect(rr, paint(P(OUT), 'stroke', ow(s)))
    draw_text(c, month, x, y - h / 2 + h * 0.2, font(FONT_BOLD, int(s * 0.15)), P('white'))
    f = fit_font(year, FONT_HEAD, int(s * 0.36), w * 0.86)
    draw_text(c, year, x, y + h * 0.27, f, P('navy'))
    for sg in (-1, 1):
        rrect(c, x + sg * w * 0.27 - s * 0.03, y - h / 2 - s * 0.07, s * 0.06, s * 0.16, s * 0.03, P('grey'),
              stroke=(P(OUT), ow(s) * 0.6))

def person(c, x, y, s, suit='navy2', tie='gold', skin='paper2', alpha=1.0, crown=False):
    """Faceless silhouette in a suit (no face features)."""
    head_r = s * 0.15
    # body
    body = [(x - s * 0.32, y + s * 0.5), (x - s * 0.3, y - s * 0.05), (x - s * 0.18, y - s * 0.18),
            (x + s * 0.18, y - s * 0.18), (x + s * 0.3, y - s * 0.05), (x + s * 0.32, y + s * 0.5)]
    poly(c, body, P(suit), alpha, shadow=True, stroke=(P(OUT), ow(s)))
    # shirt + tie
    poly(c, [(x - s * 0.08, y - s * 0.18), (x + s * 0.08, y - s * 0.18), (x, y + s * 0.05)], P('paper'), alpha)
    poly(c, [(x - s * 0.03, y - s * 0.15), (x + s * 0.03, y - s * 0.15), (x + s * 0.045, y + s * 0.18),
             (x, y + s * 0.26), (x - s * 0.045, y + s * 0.18)], P(tie), alpha)
    circle(c, x, y - s * 0.33, head_r, P(skin), alpha, shadow=True, stroke=(P(OUT), ow(s)))
    if crown:
        cx, cy = x, y - s * 0.52
        poly(c, [(cx - s * 0.12, cy + s * 0.05), (cx - s * 0.12, cy - s * 0.06), (cx - s * 0.06, cy),
                 (cx, cy - s * 0.09), (cx + s * 0.06, cy), (cx + s * 0.12, cy - s * 0.06), (cx + s * 0.12, cy + s * 0.05)],
             P('gold'), alpha, stroke=(P(OUT), ow(s) * 0.7))

def fan(c, x, y, s, color='red', alpha=1.0, arms=True):
    circle(c, x, y - s * 0.3, s * 0.15, P('paper2'), alpha, stroke=(P(OUT), ow(s)))
    body = [(x - s * 0.25, y + s * 0.5), (x - s * 0.22, y - s * 0.1), (x + s * 0.22, y - s * 0.1), (x + s * 0.25, y + s * 0.5)]
    poly(c, body, P(color), alpha, stroke=(P(OUT), ow(s)))
    if arms:
        line(c, x - s * 0.2, y - s * 0.05, x - s * 0.36, y - s * 0.45, P(color), s * 0.09, alpha)
        line(c, x + s * 0.2, y - s * 0.05, x + s * 0.36, y - s * 0.45, P(color), s * 0.09, alpha)

def crowd(c, x, y, s, n=7, colors=('red', 'paper', 'red', 'gold', 'red', 'paper', 'red'), t=0.0):
    for i in range(n):
        xx = x - (n - 1) / 2 * s * 0.42 + i * s * 0.42
        bob = math.sin(t * 6 + i * 1.3) * s * 0.03
        fan(c, xx, y + bob + (i % 2) * s * 0.06, s * 0.8, colors[i % len(colors)])

def building(c, x, y, s, color='paper', label=None):
    w, h = s * 0.9, s
    poly(c, [(x - w / 2 - s * 0.05, y - h * 0.22), (x, y - h / 2), (x + w / 2 + s * 0.05, y - h * 0.22)],
         P(color), shadow=True, stroke=(P(OUT), ow(s)))
    rrect(c, x - w / 2, y - h * 0.22, w, h * 0.66, 0, P(color), shadow=True, stroke=(P(OUT), ow(s)))
    for i in range(4):
        xx = x - w * 0.36 + i * w * 0.24
        rrect(c, xx - s * 0.04, y - h * 0.14, s * 0.08, h * 0.5, 0, P('paper2'), stroke=(P(OUT), ow(s) * 0.6))
    rrect(c, x - w / 2 - s * 0.06, y + h * 0.42, w + s * 0.12, h * 0.08, 0, P(color), stroke=(P(OUT), ow(s)))
    if label:
        draw_text(c, label, x, y - h * 0.28, font(FONT_HEAD, int(s * 0.12)), P('navy'))

def chart_up(c, x, y, s, color='green', down=False):
    w, h = s * 1.2, s
    rrect(c, x - w / 2, y - h / 2, w, h, s * 0.06, P('paper'), shadow=True, stroke=(P(OUT), ow(s)))
    vals = [0.2, 0.35, 0.3, 0.55, 0.5, 0.8] if not down else [0.8, 0.6, 0.65, 0.4, 0.3, 0.15]
    pts = [(x - w * 0.4 + i * w * 0.16, y + h * 0.35 - v * h * 0.65) for i, v in enumerate(vals)]
    c.drawPath(path_from(pts, False), paint(P(color if not down else 'red'), 'stroke', s * 0.06))
    ex, ey = pts[-1]
    circle(c, ex, ey, s * 0.05, P(color if not down else 'red'))

def briefcase(c, x, y, s, color='navy2'):
    w, h = s * 1.1, s * 0.75
    hr = skia.RRect.MakeRectXY(skia.Rect.MakeXYWH(x - s * 0.18, y - h / 2 - s * 0.14, s * 0.36, s * 0.2), s * 0.05, s * 0.05)
    c.drawRRect(hr, paint(P(OUT), 'stroke', s * 0.06))
    rrect(c, x - w / 2, y - h / 2, w, h, s * 0.08, P(color), shadow=True, stroke=(P(OUT), ow(s)))
    rrect(c, x - s * 0.08, y - s * 0.06, s * 0.16, s * 0.12, s * 0.02, P('gold'))

def tv(c, x, y, s, screen='sky'):
    w, h = s * 1.3, s * 0.9
    rrect(c, x - w / 2, y - h / 2, w, h, s * 0.08, P('navy2'), shadow=True, stroke=(P(OUT), ow(s)))
    rrect(c, x - w / 2 + s * 0.08, y - h / 2 + s * 0.08, w - s * 0.16, h - s * 0.16, s * 0.04, P(screen))
    circle(c, x, y, s * 0.12, P('paper'))
    poly(c, [(x - s * 0.04, y - s * 0.07), (x - s * 0.04, y + s * 0.07), (x + s * 0.08, y)], P('navy'))
    line(c, x - s * 0.2, y + h / 2, x - s * 0.3, y + h / 2 + s * 0.15, P(OUT), s * 0.05)
    line(c, x + s * 0.2, y + h / 2, x + s * 0.3, y + h / 2 + s * 0.15, P(OUT), s * 0.05)

def globe(c, x, y, s, color='sky', land='green'):
    r = s / 2
    circle(c, x, y, r, P(color), shadow=True, stroke=(P(OUT), ow(s)))
    c.save(); c.clipPath(skia.Path.Circle(x, y, r))
    for (dx, dy, rw, rh) in [(-0.25, -0.15, 0.35, 0.25), (0.2, 0.1, 0.3, 0.35), (-0.1, 0.35, 0.25, 0.12)]:
        c.drawOval(skia.Rect.MakeXYWH(x + dx * s - rw * s / 2, y + dy * s - rh * s / 2, rw * s, rh * s), paint(P(land)))
    c.restore()
    c.drawOval(skia.Rect.MakeXYWH(x - r * 0.45, y - r, r * 0.9, 2 * r), paint(P(OUT), 'stroke', ow(s) * 0.6, alpha=0.5))
    line(c, x - r, y, x + r, y, P(OUT), ow(s) * 0.6, alpha=0.5)

def trophy(c, x, y, s, color='gold'):
    cup = [(x - s * 0.3, y - s * 0.45), (x + s * 0.3, y - s * 0.45), (x + s * 0.24, y - s * 0.1),
           (x + s * 0.08, y + s * 0.05), (x + s * 0.06, y + s * 0.22), (x - s * 0.06, y + s * 0.22),
           (x - s * 0.08, y + s * 0.05), (x - s * 0.24, y - s * 0.1)]
    for sg in (-1, 1):
        oval = skia.Rect.MakeXYWH(x + sg * s * 0.3 - s * 0.14, y - s * 0.4, s * 0.28, s * 0.26)
        c.drawOval(oval, paint(P(OUT), 'stroke', s * 0.07))
        c.drawOval(oval, paint(P(color), 'stroke', s * 0.04))
    poly(c, cup, P(color), shadow=True, stroke=(P(OUT), ow(s)))
    rrect(c, x - s * 0.22, y + s * 0.22, s * 0.44, s * 0.12, s * 0.02, P(color), stroke=(P(OUT), ow(s)))
    rrect(c, x - s * 0.3, y + s * 0.34, s * 0.6, s * 0.14, s * 0.02, P('navy2'), stroke=(P(OUT), ow(s)))
    line(c, x - s * 0.15, y - s * 0.35, x - s * 0.12, y - s * 0.15, P('paper'), s * 0.04, alpha=0.6)

def house(c, x, y, s, color='paper', roof='red'):
    w = s * 0.9
    rrect(c, x - w / 2, y - s * 0.1, w, s * 0.6, 0, P(color), shadow=True, stroke=(P(OUT), ow(s)))
    poly(c, [(x - w * 0.62, y - s * 0.08), (x, y - s * 0.55), (x + w * 0.62, y - s * 0.08)], P(roof),
         shadow=True, stroke=(P(OUT), ow(s)))
    rrect(c, x - s * 0.1, y + s * 0.18, s * 0.2, s * 0.32, 0, P('navy2'), stroke=(P(OUT), ow(s) * 0.6))
    rrect(c, x + s * 0.17, y + s * 0.02, s * 0.16, s * 0.14, 0, P('sky'), stroke=(P(OUT), ow(s) * 0.6))

def chain_ball(c, x, y, s, label='DEBT'):
    # chain links going up-left from the ball
    for i in range(5):
        lx, ly = x - s * 0.55 - i * s * 0.16, y - s * 0.2 - i * s * 0.1
        c.save(); c.translate(lx, ly); c.rotate(30 if i % 2 else -10)
        rr = skia.RRect.MakeRectXY(skia.Rect.MakeXYWH(-s * 0.1, -s * 0.05, s * 0.2, s * 0.1), s * 0.05, s * 0.05)
        c.drawRRect(rr, paint(P(OUT), 'stroke', s * 0.05)); c.drawRRect(rr, paint(P('grey'), 'stroke', s * 0.03))
        c.restore()
    circle(c, x, y, s * 0.5, P('navy2'), shadow=True, stroke=(P(OUT), ow(s)))
    circle(c, x - s * 0.17, y - s * 0.17, s * 0.1, P('paper'), alpha=0.25)
    f = fit_font(label, FONT_HEAD, int(s * 0.22), s * 0.85)
    draw_text(c, label, x, y + s * 0.08, f, P('red'))

def ballot_box(c, x, y, s, t=0.0):
    w, h = s * 1.0, s * 0.75
    # papers falling in
    for i in range(3):
        ph = (t * 0.9 + i / 3) % 1.0
        py = y - s * 0.9 + ph * s * 0.6
        a = 1 - ph
        rrect(c, x - s * 0.15 + i * s * 0.05 - s * 0.05, py, s * 0.26, s * 0.32, s * 0.02, P('paper'), alpha=a,
              stroke=(P(OUT), ow(s) * 0.6))
        line(c, x - s * 0.1 + i * s * 0.05 - s * 0.05, py + s * 0.18, x - s * 0.02 + i * s * 0.05, py + s * 0.24,
             P('green2'), s * 0.025, alpha=a)
    rrect(c, x - w / 2, y - h / 2, w, h, s * 0.05, P('sky'), shadow=True, stroke=(P(OUT), ow(s)))
    rrect(c, x - s * 0.25, y - h / 2 - s * 0.03, s * 0.5, s * 0.06, s * 0.03, P('navy'))
    draw_text(c, 'VOTE', x, y + s * 0.12, font(FONT_HEAD, int(s * 0.2)), P('paper'))

def ticket(c, x, y, s, color='gold'):
    w, h = s * 1.4, s * 0.7
    rrect(c, x - w / 2, y - h / 2, w, h, s * 0.06, P(color), shadow=True, stroke=(P(OUT), ow(s)))
    line(c, x + w * 0.22, y - h / 2 + s * 0.06, x + w * 0.22, y + h / 2 - s * 0.06, P(OUT), s * 0.02, dash=[10, 8])
    draw_text(c, 'SEASON', x - w * 0.12, y - s * 0.02, font(FONT_HEAD, int(s * 0.14)), P('navy'))
    draw_text(c, 'TICKET', x - w * 0.12, y + s * 0.15, font(FONT_HEAD, int(s * 0.14)), P('navy'))

def magnifier(c, x, y, s):
    line(c, x + s * 0.15, y + s * 0.15, x + s * 0.45, y + s * 0.45, P(OUT), s * 0.14)
    line(c, x + s * 0.15, y + s * 0.15, x + s * 0.45, y + s * 0.45, P('gold'), s * 0.08)
    circle(c, x - s * 0.08, y - s * 0.08, s * 0.32, P('sky'), alpha=0.45, stroke=(P(OUT), s * 0.07))

def question(c, x, y, s, color='gold'):
    draw_text(c, '?', x, y + s * 0.38, font(FONT_HEAD, int(s * 1.05)), P(color), shadow=True, outline=(P(OUT), s * 0.03))

def academy(c, x, y, s):
    building(c, x, y, s, 'paper')
    circle(c, x + s * 0.5, y + s * 0.38, s * 0.16, P('white'), stroke=(P(OUT), ow(s)))
    poly(c, [(x + s * 0.5, y + s * 0.3), (x + s * 0.57, y + s * 0.36), (x + s * 0.54, y + s * 0.45),
             (x + s * 0.46, y + s * 0.45), (x + s * 0.43, y + s * 0.36)], P('navy'))

def players(c, x, y, s, color='sky'):
    for i, dx in enumerate((-0.35, 0.35, 0.0)):
        sc = 0.85 if i < 2 else 1.0
        xx, yy = x + dx * s, y + (0.06 if i < 2 else 0.12) * s
        shirt(c, xx, yy, s * 0.55 * sc, color, number=(7, 11, 10)[i])

def pitch(c, x, y, s, color='green2'):
    w, h = s * 1.5, s
    rrect(c, x - w / 2, y - h / 2, w, h, s * 0.03, P(color), shadow=True, stroke=(P(OUT), ow(s)))
    pp = paint(P('paper'), 'stroke', s * 0.015, alpha=0.9)
    c.drawRect(skia.Rect.MakeXYWH(x - w / 2 + s * 0.05, y - h / 2 + s * 0.05, w - s * 0.1, h - s * 0.1), pp)
    c.drawLine(x, y - h / 2 + s * 0.05, x, y + h / 2 - s * 0.05, pp)
    c.drawCircle(x, y, s * 0.13, pp)

def padlock(c, x, y, s, color='gold'):
    oval = skia.Rect.MakeXYWH(x - s * 0.25, y - s * 0.5, s * 0.5, s * 0.6)
    c.drawArc(oval, 180, 180, False, paint(P(OUT), 'stroke', s * 0.13))
    c.drawArc(oval, 180, 180, False, paint(P('grey'), 'stroke', s * 0.08))
    rrect(c, x - s * 0.38, y - s * 0.2, s * 0.76, s * 0.62, s * 0.08, P(color), shadow=True, stroke=(P(OUT), ow(s)))
    circle(c, x, y + s * 0.05, s * 0.07, P('navy'))
    line(c, x, y + s * 0.05, x, y + s * 0.22, P('navy'), s * 0.05)

ICONS = {
    'shirt': shirt, 'coin': coin, 'coins': coin_stack, 'note': banknote, 'stadium': stadium,
    'document': document, 'calendar': calendar, 'person': person, 'fan': fan, 'crowd': crowd,
    'building': building, 'bank': building, 'chart': chart_up, 'briefcase': briefcase, 'tv': tv,
    'globe': globe, 'trophy': trophy, 'house': house, 'debt': chain_ball, 'ballot': ballot_box,
    'ticket': ticket, 'magnifier': magnifier, 'question': question, 'academy': academy,
    'players': players, 'pitch': pitch, 'padlock': padlock,
}

def icon(c, name, x, y, s, t=0.0, **kw):
    fn = ICONS[name]
    if name in ('ballot', 'crowd'):
        kw.setdefault('t', t)
    fn(c, x, y, s, **kw)
