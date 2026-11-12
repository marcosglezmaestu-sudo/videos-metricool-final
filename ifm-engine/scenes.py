"""Scene templates. Each template: fn(c, t, d, sp) -> None. t = local time (s), d = scene duration.
Times in specs ('at') are already resolved to seconds by the timeline."""
import math
import skia
from draw import *
import icons as I

def colors(sp):
    bg, fg, ac = BG.get(sp.get('bg', 'navy'))
    return bg, sp.get('fg', fg), sp.get('accent', ac)

def at(item, default=0.0):
    return item.get('at', default) if isinstance(item, dict) else default

def header(c, t, sp, y=120):
    """Tifo-style heading at the top: big title + small spaced subtitle."""
    if not sp.get('title'): return
    bg, fg, ac = colors(sp)
    p = ease_out(prog(t, sp.get('title_at', 0.0), 0.45))
    f = fit_font(sp['title'], FONT_HEAD, sp.get('title_size', 76), W - 260)
    c.save(); c.translate(0, (1 - p) * -40)
    draw_text(c, sp['title'], W / 2, y, f, P(sp.get('title_color', fg)), alpha=p, shadow=True)
    if sp.get('subtitle'):
        sf = font(FONT_SEMI, 30)
        s = ' '.join(sp['subtitle'].upper())
        draw_text(c, s, W / 2, y + 52, fit_font(s, FONT_SEMI, 28, W - 300), P(sp.get('title_color', fg)), alpha=p * 0.7)
    c.restore()

def label_chip(c, text, x, y, size=38, color='navy', tcolor='paper', alpha=1.0, font_name=FONT_BOLD):
    f = font(font_name, size)
    w = text_w(text, f) + size * 1.1
    h = size * 1.6
    rrect(c, x - w / 2, y - h / 2, w, h, h * 0.22, P(color), alpha, shadow=True)
    draw_text(c, text, x, y + size * 0.36, f, P(tcolor), alpha=alpha)
    return w

# ------------------------------------------------------------------ templates
def T_chapter(c, t, d, sp):
    bg, fg, ac = colors(sp)
    # number tile slides in
    p1 = ease_back(prog(t, 0.0, 0.5))
    tile = sp.get('num', '1')
    x0 = lerp(-300, 560, p1)
    rrect(c, x0 - 150, 540 - 170, 300, 300, 40, P(sp.get('tile', 'gold')), shadow=True, stroke=(P('navy'), 8))
    draw_text(c, tile, x0, 540 + 85, font(FONT_HEAD, 240), P('navy'))
    p2 = ease_out(prog(t, 0.25, 0.5))
    f = font(FONT_BOLD, 40)
    draw_text(c, ' '.join(sp.get('kicker', 'TYPE').upper()), 800, 450, f, P(fg), 'left', alpha=p2 * 0.8)
    lines = sp['text'].upper().split('\n')
    for i, ln in enumerate(lines):
        pi = ease_out(prog(t, 0.35 + i * 0.15, 0.5))
        c.save(); c.translate((1 - pi) * 80, 0)
        ff = fit_font(ln, FONT_HEAD, 120, 1000)
        draw_text(c, ln, 800, 580 + i * 125, ff, P(ac if i == len(lines) - 1 else fg), 'left', alpha=pi, shadow=True)
        c.restore()
    # underline bar grows
    pb = ease_out(prog(t, 0.6, 0.6))
    rrect(c, 800, 640 + (len(lines) - 1) * 125, 600 * pb, 14, 7, P(ac))

def T_logo(c, t, d, sp):
    # IFM sting: coin flips in, words stack
    p = ease_back(prog(t, 0.0, 0.6))
    c.save(); c.translate(W / 2, 400); sx = abs(math.cos(min(t, 0.9) * math.pi * 2)) if t < 0.9 else 1
    c.scale(max(0.05, sx) * p, p); I.coin(c, 0, 0, 220); c.restore()
    words = ['INSIDE', 'FOOTBALL', 'MONEY']
    f = font(FONT_HEAD, 104); sp_ = 34
    ws = [text_w(w_, f) for w_ in words]; total = sum(ws) + sp_ * 2
    x = W / 2 - total / 2
    for i, wd in enumerate(words):
        pi = ease_out(prog(t, 0.45 + i * 0.12, 0.4))
        col = P('gold') if wd == 'MONEY' else P('paper')
        c.save(); c.translate(0, (1 - pi) * 40)
        draw_text(c, wd, x, 690, f, col, 'left', alpha=pi, shadow=True)
        c.restore()
        x += ws[i] + sp_
    pl = ease_out(prog(t, 1.0, 0.5))
    rrect(c, W / 2 - total / 2, 730, total * pl, 10, 5, P('gold'))

def T_bignum(c, t, d, sp):
    bg, fg, ac = colors(sp)
    header(c, t, sp)
    a0 = sp.get('num_at', 0.15)
    p = prog(t, a0, sp.get('count', 0.8))
    val = sp.get('value', 0)
    shown = val * ease_out(p)
    fmt = sp.get('fmt', '{:,.0f}')
    s = sp.get('prefix', '') + fmt.format(shown) + sp.get('suffix', '')
    cx = sp.get('x', W / 2 + (180 if sp.get('icon') else 0))
    ps = ease_back(prog(t, a0, 0.45))
    c.save(); pop_scale(c, cx, 560, ps)
    f = fit_font(s, FONT_NUM, sp.get('size', 260), 1150)
    draw_text(c, s, cx, 640, f, P(sp.get('num_color', ac)), shadow=True, outline=(P('navy'), 6))
    c.restore()
    if sp.get('label'):
        pl = ease_out(prog(t, a0 + 0.35, 0.4))
        f2 = fit_font(sp['label'].upper(), FONT_HEAD, 54, 1200)
        draw_text(c, sp['label'].upper(), cx, 750, f2, P(fg), alpha=pl)
    if sp.get('sub'):
        pl = ease_out(prog(t, at(sp, 0) + sp.get('sub_at', a0 + 0.7), 0.4))
        f3 = fit_font(sp['sub'], FONT_SEMI, 36, 1300)
        draw_text(c, sp['sub'], cx, 815, f3, P(fg), alpha=pl * 0.85)
    if sp.get('icon'):
        pi = ease_back(prog(t, 0.0, 0.45))
        c.save(); pop_scale(c, 380, 540, pi)
        I.icon(c, sp['icon'], 380, 540, sp.get('icon_size', 300), t=t, **sp.get('icon_kw', {}))
        c.restore()

def T_icons(c, t, d, sp):
    bg, fg, ac = colors(sp)
    header(c, t, sp)
    items = sp['items']; n = len(items)
    gap = min(420, (W - 200) / n)
    y = sp.get('y', 560 if sp.get('title') else 520)
    for i, it in enumerate(items):
        x = W / 2 - (n - 1) / 2 * gap + i * gap
        p = prog(t, at(it, 0.1 + i * 0.25), 0.45)
        if p <= 0: continue
        c.save(); pop_scale(c, x, y, p)
        I.icon(c, it['icon'], x, y, it.get('size', sp.get('size', 230)), t=t, **it.get('kw', {}))
        c.restore()
        if it.get('label'):
            pl = ease_out(prog(t, at(it, 0.1 + i * 0.25) + 0.15, 0.35))
            f = fit_font(it['label'].upper(), FONT_HEAD, sp.get('label_size', 44), gap - 30)
            draw_text(c, it['label'].upper(), x, y + sp.get('label_dy', 230), f, P(it.get('label_color', fg)), alpha=pl, shadow=True)
    if sp.get('extra_crowd'):
        cols = ('red', 'paper', 'red', 'gold', 'red', 'paper', 'red', 'sky', 'red', 'paper', 'gold', 'red', 'paper')
        pc = ease_out(prog(t, 0.2, 0.6))
        c.save(); c.translate(0, (1 - pc) * 300)
        I.crowd(c, W / 2, 1000, 230, n=13, colors=cols, t=t)
        c.restore()

def T_question(c, t, d, sp):
    bg, fg, ac = colors(sp)
    has_icon = 'icon' in sp
    tx = 1230 if has_icon else W / 2
    maxw = 1020 if has_icon else 1600
    f = font(FONT_HEAD, sp.get('size', 110))
    lines = wrap(sp['text'].upper(), f, maxw)
    while len(lines) > 4 and f.getSize() > 50:
        f = font(FONT_HEAD, f.getSize() - 8); lines = wrap(sp['text'].upper(), f, maxw)
    total = len(lines) * f.getSize() * 1.1
    y0 = 540 - total / 2 + f.getSize() * 0.8
    hl = set(w.upper() for w in sp.get('hl', []))
    for i, ln in enumerate(lines):
        pi = ease_out(prog(t, 0.1 + i * 0.14, 0.4))
        c.save(); c.translate(0, (1 - pi) * 30)
        draw_lines(c, [ln], tx, y0 + i * f.getSize() * 1.1, f, P(fg), alpha=pi, shadow=True, highlight=hl, hl_color=P(ac))
        c.restore()
    if has_icon:
        p = ease_back(prog(t, 0.0, 0.5))
        c.save(); pop_scale(c, 470, 540, p)
        I.icon(c, sp['icon'], 470, 540, sp.get('icon_size', 420), t=t, **sp.get('icon_kw', {}))
        c.restore()

def T_calendar(c, t, d, sp):
    bg, fg, ac = colors(sp)
    header(c, t, sp)
    # pages flip through years if 'from' given
    years = sp.get('years', [sp.get('year', '2005')])
    k = min(len(years) - 1, int(prog(t, 0.1, sp.get('flip', 0.25 * len(years))) * len(years)))
    p = ease_back(prog(t, 0.0, 0.45))
    both = bool(sp.get('caption')) and bool(sp.get('icon2'))
    cx = sp.get('x', 560 if sp.get('caption') or sp.get('icon2') else W / 2)
    cy = 470 if both else 560
    c.save(); pop_scale(c, cx, cy, p)
    I.calendar(c, cx, cy, sp.get('cal_size', 340 if both else 380), month=sp.get('month', 'JAN'), year=str(years[k]),
               color=sp.get('cal_color', 'red'))
    c.restore()
    if sp.get('caption'):
        f = font(FONT_HEAD, sp.get('cap_size', 72))
        lines = []
        for part in sp['caption'].split('\n'):
            lines += wrap(part.upper(), f, 900 if not both else 1500)
        if both:
            text1 = ' '.join(lines)
            ff = fit_font(text1, FONT_HEAD, 74, 1500)
            pi = ease_out(prog(t, sp.get('cap_at', 0.35), 0.4))
            draw_text(c, text1, W / 2, 860, ff, P(ac), alpha=pi, shadow=True)
        else:
            for i, ln in enumerate(lines):
                pi = ease_out(prog(t, sp.get('cap_at', 0.35) + i * 0.12, 0.4))
                col = P(ac) if i == sp.get('hl_line', -1) else P(fg)
                draw_text(c, ln, 1000, 470 + i * f.getSize() * 1.12, f, col, 'left', alpha=pi, shadow=True)
    if sp.get('icon2'):
        pi = prog(t, sp.get('icon2_at', 0.6), 0.45)
        ix = 1360
        c.save(); pop_scale(c, ix, cy, pi)
        I.icon(c, sp['icon2'], ix, cy, sp.get('icon2_size', 320), t=t, **sp.get('icon2_kw', {}))
        c.restore()

def T_pie(c, t, d, sp):
    bg, fg, ac = colors(sp)
    header(c, t, sp)
    cx, cy, r = sp.get('cx', 660), sp.get('cy', 590), sp.get('r', 300)
    slices = sp['slices']; tot = sum(s_['value'] for s_ in slices)
    p0 = ease_out(prog(t, min(at(s_, 0.3) for s_ in slices), 0.6))
    c.drawCircle(cx + 12, cy + 14, r * p0, shadow_paint(0.3 * p0))
    start = -90
    for i, s_ in enumerate(slices):
        sweep = 360 * s_['value'] / tot
        p = ease_out(prog(t, at(s_, 0.2 + i * 0.5), 0.6))
        rect = skia.Rect.MakeXYWH(cx - r, cy - r, 2 * r, 2 * r)
        if p > 0:
            c.drawArc(rect, start, sweep * p, True, paint(P(s_['color'])))
            c.drawArc(rect, start, sweep * p, True, paint(P('navy'), 'stroke', 6))
        # legend
        pl = ease_out(prog(t, at(s_, 0.2 + i * 0.5) + 0.2, 0.4))
        ly = cy - (len(slices) - 1) * 75 + i * 150
        rrect(c, 1080, ly - 34, 56, 56, 12, P(s_['color']), pl, shadow=True, stroke=(P('navy'), 4))
        f = fit_font(s_['label'].upper(), FONT_HEAD, 50, 640)
        draw_text(c, s_['label'].upper(), 1160, ly + 4, f, P(fg), 'left', alpha=pl)
        if s_.get('note'):
            draw_text(c, s_['note'], 1160, ly + 50, fit_font(s_['note'], FONT_SEMI, 32, 640), P(fg), 'left', alpha=pl * 0.8)
        start += sweep
    if sp.get('center'):
        pc = ease_back(prog(t, sp.get('center_at', 0.8), 0.4))
        c.save(); pop_scale(c, cx, cy, pc)
        circle(c, cx, cy, r * 0.42, P(bg), stroke=(P('navy'), 6))
        f = fit_font(sp['center'], FONT_NUM, 110, r * 0.75)
        draw_text(c, sp['center'], cx, cy + 38, f, P(fg))
        c.restore()

def T_bars(c, t, d, sp):
    bg, fg, ac = colors(sp)
    header(c, t, sp)
    rows = sp['rows']; n = len(rows)
    vmax = sp.get('max', max(r_['value'] for r_ in rows))
    top = sp.get('top', 330); rh = min(150, 560 / n)
    for i, r_ in enumerate(rows):
        y = top + i * rh
        p = ease_out(prog(t, at(r_, 0.2 + i * 0.45), 0.8))
        pl = ease_out(prog(t, at(r_, 0.2 + i * 0.45), 0.3))
        draw_text(c, r_['label'].upper(), 560, y + rh * 0.42, fit_font(r_['label'].upper(), FONT_HEAD, 46, 400), P(fg), 'right', alpha=pl)
        bw = 900 * r_['value'] / vmax * p
        rrect(c, 600, y + rh * 0.1, max(bw, 1), rh * 0.55, 14, P(r_.get('color', ac)), pl, shadow=True, stroke=(P('navy'), 4))
        disp = r_.get('display', '')
        if disp:
            draw_text(c, disp, 600 + bw + 24, y + rh * 0.47, font(FONT_NUM, int(rh * 0.42)), P(fg), 'left', alpha=pl)

def T_list(c, t, d, sp):
    bg, fg, ac = colors(sp)
    header(c, t, sp)
    items = sp['items']; n = len(items)
    top = sp.get('top', 330 if sp.get('title') else 300)
    rh = min(sp.get('rh', 170), (920 - top) / max(1, n - 1) if n > 1 else 170)
    x0 = sp.get('x', 380)
    for i, it in enumerate(items):
        y = top + i * rh
        p = ease_out(prog(t, at(it, 0.2 + i * 0.5), 0.4))
        if p <= 0: continue
        c.save(); c.translate((1 - p) * -60, 0)
        mark = it.get('mark', sp.get('mark', 'num'))
        mx = x0
        if mark == 'tick':
            circle(c, mx, y, 38, P('green2'), p, shadow=True, stroke=(P('navy'), 5))
            c.drawPath(path_from([(mx - 17, y + 1), (mx - 4, y + 15), (mx + 19, y - 13)], False), paint(P('paper'), 'stroke', 10, alpha=p))
        elif mark == 'cross':
            circle(c, mx, y, 38, P('red'), p, shadow=True, stroke=(P('navy'), 5))
            line(c, mx - 14, y - 14, mx + 14, y + 14, P('paper'), 10, p); line(c, mx + 14, y - 14, mx - 14, y + 14, P('paper'), 10, p)
        elif mark == 'icon':
            I.icon(c, it['icon'], mx, y, 120, t=t, **it.get('kw', {}))
        else:
            rrect(c, mx - 40, y - 40, 80, 80, 16, P(it.get('color', ac)), p, shadow=True, stroke=(P('navy'), 5))
            draw_text(c, str(it.get('n', i + 1)), mx, y + 24, font(FONT_HEAD, 60), P('navy'), alpha=p)
        f = fit_font(it['text'].upper() if sp.get('upper', True) else it['text'], FONT_HEAD, sp.get('size', 60), W - x0 - 260)
        draw_text(c, it['text'].upper() if sp.get('upper', True) else it['text'], mx + 80, y + 22, f, P(it.get('tcolor', fg)), 'left', alpha=p, shadow=True)
        c.restore()

def T_quote(c, t, d, sp):
    bg, fg, ac = colors(sp)
    if sp.get('icon'):
        c.save(); I.icon(c, sp['icon'], W / 2, 560, 560, t=t); c.restore()
        c.drawRect(skia.Rect.MakeWH(W, H), paint(P(bg), alpha=0.72))
    f = font('Montserrat-ExtraBold', sp.get('size', 64))
    lines = wrap('“' + sp['text'] + '”', f, 1250)
    bh = len(lines) * f.getSize() * 1.25 + 120
    p = ease_out(prog(t, 0.1, 0.45))
    bx, by = W / 2 - 720, 540 - bh / 2
    rrect(c, bx, by, 1440, bh, 24, P('navy'), p * 0.92, shadow=True, stroke=(P(ac), 5))
    nshown = int(len(' '.join(lines)) * clamp((t - 0.3) / max(0.6, sp.get('type_speed', 1.6))))
    acc = 0
    for i, ln in enumerate(lines):
        vis = ln[:max(0, nshown - acc)]; acc += len(ln) + 1
        draw_text(c, vis, W / 2, by + 90 + i * f.getSize() * 1.25, f, P('gold2' if bg != 'gold' else 'paper'), alpha=p)
    if sp.get('who'):
        pw = ease_out(prog(t, sp.get('who_at', 1.4), 0.4))
        draw_text(c, '— ' + sp['who'], W / 2, by + bh + 70, fit_font(sp['who'], FONT_SEMI, 38, 1300), P(fg), alpha=pw)

def T_flow(c, t, d, sp):
    """Nodes with icons + arrows with travelling coins."""
    bg, fg, ac = colors(sp)
    header(c, t, sp)
    nodes = {n_['id']: n_ for n_ in sp['nodes']}
    for e in sp.get('edges', []):
        a, b = nodes[e['from']], nodes[e['to']]
        p = ease_in_out(prog(t, at(e, 0.6), 0.7))
        if p <= 0: continue
        r_off = e.get('off', 150)
        ang = math.atan2(b['y'] - a['y'], b['x'] - a['x'])
        x1, y1 = a['x'] + math.cos(ang) * r_off, a['y'] + math.sin(ang) * r_off
        x2, y2 = b['x'] - math.cos(ang) * r_off, b['y'] - math.sin(ang) * r_off
        col = P(e.get('color', ac))
        arrow(c, x1, y1, x2, y2, col, 12, 34, progress=p, curve=e.get('curve', 0.0), dash=[26, 16] if e.get('dash') else None)
        if e.get('cut') and t > at(e, 0.6) + e.get('cut_at', 1.2):
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            pc = ease_back(prog(t, at(e, 0.6) + e.get('cut_at', 1.2), 0.3))
            c.save(); pop_scale(c, mx, my, pc)
            circle(c, mx, my, 46, P('red'), shadow=True, stroke=(P('navy'), 5))
            line(c, mx - 18, my - 18, mx + 18, my + 18, P('paper'), 10); line(c, mx + 18, my - 18, mx - 18, my + 18, P('paper'), 10)
            c.restore()
        if e.get('label') and p > 0.5:
            pl = ease_out(prog(t, at(e, 0.6) + 0.35, 0.3))
            mx, my = (x1 + x2) / 2 - (y2 - y1) * e.get('curve', 0) , (y1 + y2) / 2 + (x2 - x1) * e.get('curve', 0)
            label_chip(c, e['label'].upper(), mx, my + e.get('ldy', -50), 30, e.get('chip', 'navy'), e.get('chip_t', 'paper'), pl)
        if e.get('coins') and p >= 1 and not (e.get('cut')):
            for k in range(3):
                u = ((t - at(e, 0.6) - 0.7) * 0.6 + k / 3) % 1.0
                cx_ = lerp(x1, x2, u); cy_ = lerp(y1, y2, u) - math.sin(u * math.pi) * 40 * (1 if e.get('curve', 0) >= 0 else -1)
                I.coin(c, cx_, cy_, 54, sym=e.get('sym', '£'))
    for n_ in sp['nodes']:
        p = prog(t, at(n_, 0.1), 0.45)
        if p <= 0: continue
        c.save(); pop_scale(c, n_['x'], n_['y'], p)
        if n_.get('icon'):
            I.icon(c, n_['icon'], n_['x'], n_['y'], n_.get('size', 220), t=t, **n_.get('kw', {}))
        else:
            circle(c, n_['x'], n_['y'], n_.get('size', 200) / 2, P(n_.get('color', 'paper')), shadow=True, stroke=(P('navy'), 6))
            if n_.get('text'):
                draw_text(c, n_['text'], n_['x'], n_['y'] + 20, fit_font(n_['text'], FONT_HEAD, 60, n_.get('size', 200) * 0.8), P('navy'))
        c.restore()
        if n_.get('label'):
            pl = ease_out(prog(t, at(n_, 0.1) + 0.2, 0.3))
            label_chip(c, n_['label'].upper(), n_['x'], n_['y'] + n_.get('ldy', n_.get('size', 220) * 0.5 + 70), 34,
                       n_.get('chip', 'navy'), n_.get('chip_t', 'paper'), pl)

def T_map(c, t, d, sp):
    bg, fg, ac = colors(sp)
    view = sp.get('view', (-170, 190, -56, 80))
    # keep aspect: fit lon/lat box into screen with margin
    lo0, lo1, la0, la1 = view
    bw = W - 120; bh = bw * (la1 - la0) / (lo1 - lo0)
    if bh > H - 120:
        bh = H - 120; bw = bh * (lo1 - lo0) / (la1 - la0)
    box = ((W - bw) / 2, (H - bh) / 2 + sp.get('dy', 30), bw, bh, lo0, lo1, la0, la1)
    hl = {}
    for name, (col, a_) in sp.get('hl', {}).items():
        if t >= a_: hl[name] = col
    # zoom-in drift
    z = 1 + 0.04 * clamp(t / max(d, 1))
    c.save(); c.translate(W / 2, H / 2); c.scale(z, z); c.translate(-W / 2, -H / 2)
    draw_world(c, box, sp.get('land', 'navy3') if bg == 'navy' else sp.get('land', 'paper'), hl,
               outline='navy' if bg != 'navy' else 'navy')
    for a in sp.get('arcs', []):
        p = ease_in_out(prog(t, at(a, 0.6), 0.9))
        x1, y1 = proj(*a['from'], box); x2, y2 = proj(*a['to'], box)
        arrow(c, x1, y1, x2, y2, P(a.get('color', 'gold')), 9, 28, progress=p, curve=a.get('curve', -0.25), dash=[22, 14])
    for pn in sp.get('pins', []):
        p = prog(t, at(pn, 0.5), 0.4)
        if p <= 0: continue
        x, y = proj(pn['lon'], pn['lat'], box)
        c.save(); pop_scale(c, x, y, p)
        circle(c, x, y, 16, P(pn.get('color', 'gold')), shadow=True, stroke=(P('navy'), 5))
        c.restore()
        if pn.get('label'):
            label_chip(c, pn['label'].upper(), x + pn.get('ldx', 0), y + pn.get('ldy', -52), pn.get('lsize', 28),
                       pn.get('chip', 'navy'), pn.get('chip_t', 'paper'), ease_out(p))
    c.restore()
    if sp.get('title'):
        header(c, t, dict(sp, title_color=sp.get('title_color', fg)), y=sp.get('title_y', 110))
    if sp.get('big'):
        pb = ease_back(prog(t, sp.get('big_at', 0.8), 0.45))
        bx, by = sp.get('big_x', 1560), sp.get('big_y', 860)
        c.save(); pop_scale(c, bx, by, pb)
        f = fit_font(sp['big'], FONT_NUM, 150, 600)
        tw = text_w(sp['big'], f)
        rrect(c, bx - tw / 2 - 40, by - 130, tw + 80, 175, 26, P(ac), shadow=True, stroke=(P('navy'), 6))
        draw_text(c, sp['big'], bx, by + 18, f, P('navy'))
        if sp.get('big_label'):
            draw_text(c, sp['big_label'].upper(), bx, by + 100, fit_font(sp['big_label'].upper(), FONT_HEAD, 40, 700), P(fg), shadow=True)
        c.restore()

def T_split(c, t, d, sp):
    bg, fg, ac = colors(sp)
    header(c, t, sp, y=110)
    for k, side in enumerate(('left', 'right')):
        s_ = sp[side]
        x = W / 4 + k * W / 2
        p = ease_out(prog(t, at(s_, 0.2 + k * 0.8), 0.5))
        if p <= 0: continue
        c.save(); c.translate(0, (1 - p) * 60)
        top = 200 if sp.get('title') else 120
        rrect(c, x - 420, top, 840, 820 - top + 120, 30, P(s_.get('color', 'paper')), p, shadow=True, stroke=(P('navy'), 6))
        draw_text(c, s_['head'].upper(), x, top + 95, fit_font(s_['head'].upper(), FONT_HEAD, 70, 760), P(s_.get('hcolor', 'navy')), alpha=p)
        if s_.get('icon'):
            I.icon(c, s_['icon'], x, top + 330, s_.get('size', 260), t=t, **s_.get('kw', {}))
        f = font(FONT_BOLD, s_.get('tsize', 44))
        lines = wrap(s_.get('text', ''), f, 720)
        for i, ln in enumerate(lines):
            draw_text(c, ln, x, top + 560 + i * f.getSize() * 1.2, f, P(s_.get('tcolor', 'navy')), alpha=p)
        c.restore()

def T_network(c, t, d, sp):
    bg, fg, ac = colors(sp)
    header(c, t, sp)
    cx, cy = sp.get('cx', W / 2), sp.get('cy', 590)
    nodes = sp['nodes']; n = len(nodes)
    R = sp.get('R', 330)
    for i, nd in enumerate(nodes):
        ang = -math.pi / 2 + i * math.tau / n + sp.get('rot', 0)
        x, y = cx + math.cos(ang) * R * 1.45, cy + math.sin(ang) * R
        p = ease_out(prog(t, at(nd, 0.5 + i * 0.25), 0.5))
        if p <= 0: continue
        line(c, cx, cy, lerp(cx, x, p), lerp(cy, y, p), P(nd.get('line', ac)), 8, dash=[18, 12] if nd.get('dash') else None)
        c.save(); pop_scale(c, x, y, prog(t, at(nd, 0.5 + i * 0.25) + 0.2, 0.4))
        I.shirt(c, x, y, nd.get('size', 150), color=nd.get('color', 'sky'), trim=nd.get('trim', 'white'))
        c.restore()
        pl = ease_out(prog(t, at(nd, 0.5 + i * 0.25) + 0.3, 0.3))
        if nd.get('label'):
            label_chip(c, nd['label'].upper(), x, y + nd.get('size', 150) * 0.5 + 50, 28, 'navy', 'paper', pl)
        if nd.get('tag'):
            label_chip(c, nd['tag'], x + 95, y - 70, 30, nd.get('tag_color', 'gold'), 'navy', pl, FONT_HEAD)
    p = ease_back(prog(t, 0.05, 0.45))
    c.save(); pop_scale(c, cx, cy, p)
    ctr = sp.get('center', {})
    if ctr.get('icon') == 'person':
        circle(c, cx, cy, 120, P(ctr.get('color', 'gold')), shadow=True, stroke=(P('navy'), 6))
        I.person(c, cx, cy + 12, 190)
    else:
        circle(c, cx, cy, 120, P(ctr.get('color', 'gold')), shadow=True, stroke=(P('navy'), 6))
        draw_text(c, ctr.get('text', 'GROUP'), cx, cy + 22, fit_font(ctr.get('text', 'GROUP'), FONT_HEAD, 56, 200), P('navy'))
    c.restore()
    if ctr.get('label'):
        label_chip(c, ctr['label'].upper(), cx, cy + 165, 32, 'navy', 'gold', ease_out(prog(t, 0.3, 0.3)), FONT_HEAD)

def T_cta(c, t, d, sp):
    bg, fg, ac = colors(sp)
    p = ease_back(prog(t, 0.1, 0.5))
    c.save(); pop_scale(c, W / 2, 380, p)
    rrect(c, W / 2 - 330, 300, 660, 160, 80, P('red'), shadow=True, stroke=(P('navy'), 7))
    draw_text(c, 'SUBSCRIBE', W / 2 + 10, 405, font(FONT_HEAD, 84), P('paper'))
    c.restore()
    # click: cursor + pressed state
    pc = prog(t, sp.get('click_at', 1.3), 0.3)
    if pc > 0:
        cx_, cy_ = lerp(W / 2 + 500, W / 2 + 120, ease_out(pc)), lerp(640, 420, ease_out(pc))
        poly(c, [(cx_, cy_), (cx_ + 18, cy_ + 64), (cx_ + 32, cy_ + 40), (cx_ + 60, cy_ + 44)], P('paper'), shadow=True, stroke=(P('navy'), 5))
    # bell
    pb = ease_back(prog(t, sp.get('click_at', 1.3) + 0.4, 0.4))
    c.save(); pop_scale(c, W / 2 + 470, 380, pb)
    circle(c, W / 2 + 470, 380, 70, P('gold'), shadow=True, stroke=(P('navy'), 6))
    draw_text(c, '♪', W / 2 + 470, 405, font(FONT_HEAD, 70), P('navy'))
    c.restore()
    if sp.get('comment'):
        pq = ease_out(prog(t, at(sp, 0) + sp.get('comment_at', 2.5), 0.5))
        f = font(FONT_HEAD, 58)
        lines = wrap(sp['comment'].upper(), f, 1300)
        bh = len(lines) * 70 + 70
        rrect(c, W / 2 - 720, 600, 1440, bh, 30, P('paper'), pq, shadow=True, stroke=(P('navy'), 6))
        poly(c, [(W / 2 - 560, 600 + bh), (W / 2 - 600, 600 + bh + 60), (W / 2 - 480, 600 + bh)], P('paper'), pq)
        for i, ln in enumerate(lines):
            draw_text(c, ln, W / 2, 680 + i * 70, f, P('navy'), alpha=pq)

def T_tiles(c, t, d, sp):
    """Numbered colour tiles (Tifo 1-2-3-4-5) with labels."""
    bg, fg, ac = colors(sp)
    header(c, t, sp)
    items = sp['items']; n = len(items)
    cols = ['red', 'sky', 'gold', 'green2', 'purple', 'teal']
    gap = 330
    for i, it in enumerate(items):
        x = W / 2 - (n - 1) / 2 * gap + i * gap; y = sp.get('y', 540)
        p = prog(t, at(it, 0.15 + i * 0.3), 0.45)
        if p <= 0: continue
        dim = sp.get('focus') is not None and sp['focus'] != i
        c.save(); pop_scale(c, x, y, p)
        rrect(c, x - 135, y - 135, 270, 270, 36, P(cols[i % len(cols)]), 0.35 if dim else 1.0, shadow=not dim, stroke=(P('navy'), 8))
        draw_text(c, str(i + 1), x, y + 70, font(FONT_HEAD, 200), P('navy'), alpha=0.35 if dim else 1.0)
        c.restore()
        pl = ease_out(prog(t, at(it, 0.15 + i * 0.3) + 0.15, 0.3))
        lines = it['label'].upper().split('\n')
        for k, ln in enumerate(lines):
            draw_text(c, ln, x, y + 205 + k * 48, fit_font(ln, FONT_HEAD, 40, 310), P(fg), alpha=pl * (0.4 if dim else 1), shadow=True)

def T_silhouette(c, t, d, sp):
    bg, fg, ac = colors(sp)
    header(c, t, sp)
    px, py = sp.get('px', 620), sp.get('py', 600)
    p = ease_back(prog(t, 0.0, 0.5))
    if sp.get('back'):
        I.icon(c, sp['back'], px, py + 210, sp.get('back_size', 260), t=t)
    c.save(); pop_scale(c, px, py, p)
    I.person(c, px, py, sp.get('size', 560), suit=sp.get('suit', 'navy2'), tie=sp.get('tie', 'gold'), crown=sp.get('crown', False))
    c.restore()
    for i, tg in enumerate(sp.get('tags', [])):
        pt = prog(t, at(tg, 0.5 + i * 0.4), 0.4)
        if pt <= 0: continue
        x = tg.get('x', 1250); y = tg.get('y', 330 + i * 150)
        c.save(); pop_scale(c, x, y, pt)
        label_chip(c, tg['text'].upper(), x, y, tg.get('size', 54), tg.get('color', 'gold'), tg.get('tcolor', 'navy'), 1.0, FONT_HEAD)
        c.restore()

def T_doc(c, t, d, sp):
    bg, fg, ac = colors(sp)
    header(c, t, sp)
    dx = sp.get('x', 600 if sp.get('caption') else W / 2)
    p = ease_back(prog(t, 0.0, 0.5))
    c.save(); pop_scale(c, dx, 580, p)
    I.document(c, dx, 580, sp.get('size', 560), title=sp.get('doc_title', ''), stamp=sp.get('stamp'),
               stamp_color=sp.get('stamp_color', 'red'), p_stamp=prog(t, sp.get('stamp_at', 1.0), 0.35))
    c.restore()
    if sp.get('caption'):
        f = font(FONT_HEAD, sp.get('cap_size', 66))
        lines = []
        for part in sp['caption'].split('\n'):
            lines += wrap(part.upper(), f, 820)
        y0 = 580 - (len(lines) - 1) * f.getSize() * 0.56
        for i, ln in enumerate(lines):
            pi = ease_out(prog(t, sp.get('cap_at', 0.4) + i * 0.15, 0.4))
            col = P(ac) if i in sp.get('hl_lines', []) else P(fg)
            draw_text(c, ln, 1000, y0 + i * f.getSize() * 1.12, f, col, 'left', alpha=pi, shadow=True)

def T_pair(c, t, d, sp):
    """Two values with an arrow between: e.g. 2008 £210M -> today BILLIONS."""
    bg, fg, ac = colors(sp)
    header(c, t, sp)
    for k, side in enumerate(('a', 'b')):
        s_ = sp[side]; x = 480 + k * 960
        p = ease_back(prog(t, at(s_, 0.2 + k * 1.0), 0.45))
        if p <= 0: continue
        c.save(); pop_scale(c, x, 560, p)
        rrect(c, x - 340, 380, 680, 360, 34, P(s_.get('color', 'paper')), shadow=True, stroke=(P('navy'), 7))
        draw_text(c, s_['top'].upper(), x, 460, fit_font(s_['top'].upper(), FONT_HEAD, 50, 600), P('navy'))
        draw_text(c, s_['value'], x, 650, fit_font(s_['value'], FONT_NUM, 170, 600), P(s_.get('vcolor', 'navy')))
        c.restore()
    pa = prog(t, at(sp['b'], 1.2) - 0.4, 0.5)
    arrow(c, 840, 560, 1100, 560, P(ac), 16, 44, progress=ease_out(pa))

def T_house(c, t, d, sp):
    """Analogy: you borrow to buy a house, then the house pays the mortgage."""
    bg, fg, ac = colors(sp)
    header(c, t, sp)
    p = ease_back(prog(t, 0.1, 0.5))
    c.save(); pop_scale(c, 620, 600, p); I.house(c, 620, 600, 380); c.restore()
    pb = prog(t, sp.get('bank_at', 1.0), 0.5)
    c.save(); pop_scale(c, 1380, 560, pb); I.building(c, 1380, 560, 300, label='BANK'); c.restore()
    pa = prog(t, sp.get('pay_at', 2.0), 0.7)
    arrow(c, 860, 560, 1180, 560, P('gold'), 12, 36, progress=ease_in_out(pa), curve=-0.15)
    if pa >= 1:
        for k in range(3):
            u = ((t - sp.get('pay_at', 2.0) - 0.7) * 0.6 + k / 3) % 1
            I.coin(c, lerp(880, 1170, u), 560 - math.sin(u * math.pi) * 60, 56)
        label_chip(c, sp.get('pay_label', 'THE HOUSE PAYS').upper(), 1020, 420, 36, 'navy', 'gold', ease_out(prog(t, sp.get('pay_at', 2.0) + 0.4, 0.3)), FONT_HEAD)
    if sp.get('tag'):
        label_chip(c, sp['tag'].upper(), 620, 880, 40, 'gold', 'navy', ease_out(prog(t, 0.6, 0.3)), FONT_HEAD)

def T_endcard(c, t, d, sp):
    bg, fg, ac = colors(sp)
    p = ease_out(prog(t, 0.1, 0.5))
    draw_text(c, 'WATCH NEXT', W / 2, 200, font(FONT_HEAD, 64), P(ac), alpha=p, shadow=True)
    pb = ease_back(prog(t, 0.3, 0.5))
    c.save(); pop_scale(c, W / 2, 560, pb)
    rrect(c, W / 2 - 560, 290, 1120, 560, 30, P('navy2'), shadow=True, stroke=(P('gold'), 8))
    I.tv(c, W / 2 - 250, 520, 250, screen='gold')
    I.trophy(c, W / 2 + 230, 520, 230)
    f = font(FONT_HEAD, 60)
    for i, ln in enumerate(wrap(sp['next'].upper(), f, 1000)):
        draw_text(c, ln, W / 2, 760 + i * 68, f, P('paper'))
    c.restore()


_IMG = {}
def load_img(path):
    if path not in _IMG:
        _IMG[path] = skia.Image.open(path)
    return _IMG[path]

def draw_image_fit(c, img, x, y, w, h, gray=False, cover=True, alpha=1.0):
    iw, ih = img.width(), img.height()
    sc = max(w / iw, h / ih) if cover else min(w / iw, h / ih)
    dw, dh = iw * sc, ih * sc
    p = skia.Paint(AntiAlias=True); p.setAlphaf(alpha)
    if gray:
        m = [0.299, 0.587, 0.114, 0, 0] * 3 + [0, 0, 0, 1, 0]
        p.setColorFilter(skia.ColorFilters.Matrix(m))
    c.save(); c.clipRect(skia.Rect.MakeXYWH(x, y, w, h))
    c.drawImageRect(img, skia.Rect.MakeXYWH(x + (w - dw) / 2, y + (h - dh) / 2, dw, dh),
                    skia.SamplingOptions(skia.FilterMode.kLinear), p)
    c.restore()

def T_photo(c, t, d, sp):
    """User-supplied image. mode='frame' (photo in a bordered frame, Tifo style) or
    mode='cutout' (transparent PNG of a person/object standing on the coloured background)."""
    bg, fg, ac = colors(sp)
    header(c, t, sp)
    img = load_img(sp['src'])
    mode = sp.get('mode', 'frame')
    p = ease_out(prog(t, 0.0, 0.5))
    if mode == 'frame':
        w, h = sp.get('w', 1180), sp.get('h', 700)
        x, y = sp.get('x', (W - w) / 2), sp.get('y', 220 if sp.get('title') else 190)
        c.save(); c.translate(0, (1 - p) * 60); c.rotate(sp.get('tilt', -1.5) * p)
        rrect(c, x - 16, y - 16, w + 32, h + 32, 8, P('paper'), p, shadow=True)
        # slow Ken Burns push inside the frame
        z = 1 + 0.06 * clamp(t / max(d, 0.1))
        c.save(); c.clipRect(skia.Rect.MakeXYWH(x, y, w, h))
        c.translate(x + w / 2, y + h / 2); c.scale(z, z); c.translate(-(x + w / 2), -(y + h / 2))
        draw_image_fit(c, img, x, y, w, h, gray=sp.get('gray', False), alpha=p)
        c.restore(); c.restore()
    else:
        h = sp.get('h', 860); w = img.width() * h / img.height()
        x = sp.get('x', 560) - w / 2; y = H - h + sp.get('dy', 0)
        c.save(); c.translate((1 - p) * -120 * (1 if sp.get('x', 560) < W / 2 else -1), 0)
        c.save(); c.translate(14, 10); draw_image_fit(c, img, x, y, w, h, gray=True, cover=False, alpha=0.25 * p); c.restore()
        draw_image_fit(c, img, x, y, w, h, gray=sp.get('gray', True), cover=False, alpha=p)
        c.restore()
    for i, tg in enumerate(sp.get('tags', [])):
        pt = prog(t, at(tg, 0.5 + i * 0.4), 0.4)
        if pt <= 0: continue
        tx, ty = tg.get('x', 1450), tg.get('y', 330 + i * 150)
        c.save(); pop_scale(c, tx, ty, pt)
        label_chip(c, tg['text'].upper(), tx, ty, tg.get('size', 50), tg.get('color', 'gold'), tg.get('tcolor', 'navy'), 1.0, FONT_HEAD)
        c.restore()
    if sp.get('credit'):
        draw_text(c, sp['credit'], W - 40, H - 30, font(FONT_SEMI, 20), P(fg), 'right', alpha=0.6)

TEMPLATES = {
    'chapter': T_chapter, 'logo': T_logo, 'bignum': T_bignum, 'icons': T_icons, 'question': T_question,
    'calendar': T_calendar, 'pie': T_pie, 'bars': T_bars, 'list': T_list, 'quote': T_quote, 'flow': T_flow,
    'map': T_map, 'split': T_split, 'network': T_network, 'cta': T_cta, 'tiles': T_tiles,
    'silhouette': T_silhouette, 'doc': T_doc, 'pair': T_pair, 'house': T_house, 'endcard': T_endcard, 'photo': T_photo,
}

def render_scene(c, t, d, sp):
    background(c, sp.get('bg', 'navy'))
    z = 1 + sp.get('zoom', 0.035) * clamp(t / max(d, 0.1))
    c.save(); c.translate(W / 2, H / 2); c.scale(z, z); c.translate(-W / 2, -H / 2)
    fn = TEMPLATES.get(sp['type'])
    if H > W:
        from scenes_v import TEMPLATES_V
        fn = TEMPLATES_V[sp['type']]
    fn(c, t, d, sp)
    c.restore()
    overlay_grain(c)
    watermark(c)


def draw_caption(c, t, chunks):
    """One-line captions for vertical video: chunk of 2-3 words, spoken word in gold. Sits above the
    platform UI band (y ~1400), centred on x."""
    for ch in chunks:
        if ch['t0'] <= t < ch['t1']:
            f = font(FONT_HEAD, 62)
            words = [w_[0].upper() for w_ in ch['words']]
            total = sum(text_w(w_, f) for w_ in words) + text_w(' ', f) * (len(words) - 1)
            while total > 960 and f.getSize() > 36:   # long words (e.g. MIDDLESBROUGH) must stay inside the safe zone
                f = font(FONT_HEAD, f.getSize() - 2)
                total = sum(text_w(w_, f) for w_ in words) + text_w(' ', f) * (len(words) - 1)
            x = 540 - total / 2; y = 1410
            for (wd, a0, a1), up in zip(ch['words'], words):
                col = P('gold') if a0 <= t < a1 else P('paper')
                draw_text(c, up, x, y, f, col, 'left', outline=(P('navy'), 12))
                draw_text(c, up, x, y, f, col, 'left')
                x += text_w(up, f) + text_w(' ', f)
            return
