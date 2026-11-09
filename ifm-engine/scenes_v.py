"""Vertical (1080x1920) layouts for Shorts/Reels. Safe zone: x 70..950, y 250..1300.
Bottom ~600 px (captions + platform UI) and the right ~130 px (buttons) stay free of content."""
import math
import skia
from draw import *
import icons as I
from scenes import colors, at, label_chip

CX = 510            # content centre x (shifted left, away from the right-hand buttons)
TOP, BOT = 260, 1290
MAXW = 820

def vheader(c, t, sp, y=330):
    if not sp.get('title'): return
    bg, fg, ac = colors(sp)
    p = ease_out(prog(t, 0.0, 0.4))
    f = font(FONT_HEAD, sp.get('title_size', 70))
    lines = wrap(sp['title'].upper(), f, MAXW)
    for i, ln in enumerate(lines):
        draw_text(c, ln, CX, y + i * f.getSize() * 1.08, f, P(sp.get('title_color', fg)), alpha=p, shadow=True)

def V_question(c, t, d, sp):
    bg, fg, ac = colors(sp)
    if sp.get('icon'):
        p = ease_back(prog(t, 0.0, 0.5))
        c.save(); pop_scale(c, CX, 520, p)
        I.icon(c, sp['icon'], CX, 520, sp.get('icon_size', 380), t=t, **sp.get('icon_kw', {}))
        c.restore()
    f = font(FONT_HEAD, sp.get('size', 96))
    lines = wrap(sp['text'].upper(), f, MAXW)
    while len(lines) > 5 and f.getSize() > 50:
        f = font(FONT_HEAD, f.getSize() - 6); lines = wrap(sp['text'].upper(), f, MAXW)
    y0 = 860 if sp.get('icon') else 760 - len(lines) * f.getSize() * 0.5
    hl = set(w.upper() for w in sp.get('hl', []))
    for i, ln in enumerate(lines):
        pi = ease_out(prog(t, 0.1 + i * 0.12, 0.4))
        c.save(); c.translate(0, (1 - pi) * 30)
        draw_lines(c, [ln], CX, y0 + i * f.getSize() * 1.1, f, P(fg), alpha=pi, shadow=True, highlight=hl, hl_color=P(ac))
        c.restore()

def V_bignum(c, t, d, sp):
    bg, fg, ac = colors(sp)
    vheader(c, t, sp)
    if sp.get('icon'):
        pi = ease_back(prog(t, 0.0, 0.45))
        c.save(); pop_scale(c, CX, 520, pi)
        I.icon(c, sp['icon'], CX, 520, sp.get('icon_size', 300), t=t, **sp.get('icon_kw', {}))
        c.restore()
    a0 = sp.get('num_at', 0.15)
    p = prog(t, a0, sp.get('count', 0.8))
    s = sp.get('prefix', '') + sp.get('fmt', '{:,.0f}').format(sp.get('value', 0) * ease_out(p)) + sp.get('suffix', '')
    ny = 920 if sp.get('icon') else 800
    ps = ease_back(prog(t, a0, 0.45))
    c.save(); pop_scale(c, CX, ny - 80, ps)
    f = fit_font(s, FONT_NUM, sp.get('size', 250), MAXW)
    draw_text(c, s, CX, ny, f, P(sp.get('num_color', ac)), shadow=True, outline=(P('navy'), 6))
    c.restore()
    if sp.get('label'):
        pl = ease_out(prog(t, a0 + 0.3, 0.4))
        f2 = font(FONT_HEAD, 50)
        for i, ln in enumerate(wrap(sp['label'].upper(), f2, MAXW)):
            draw_text(c, ln, CX, ny + 100 + i * 58, f2, P(fg), alpha=pl, shadow=True)
    if sp.get('sub'):
        pl = ease_out(prog(t, a0 + 0.6, 0.4))
        f3 = font(FONT_SEMI, 34)
        for i, ln in enumerate(wrap(sp['sub'], f3, MAXW)):
            draw_text(c, ln, CX, ny + 230 + i * 42, f3, P(fg), alpha=pl * 0.85)

def V_flow(c, t, d, sp):
    """Nodes stacked top-to-bottom (x/y in the spec are ignored; order = nodes list)."""
    bg, fg, ac = colors(sp)
    vheader(c, t, sp)
    nodes = sp['nodes']; n = len(nodes)
    top = 470 if sp.get('title') else 400
    gap = (1180 - top) / max(1, n - 1)
    pos = {nd['id']: (CX, top + i * gap) for i, nd in enumerate(nodes)}
    for e in sp.get('edges', []):
        (x1, y1), (x2, y2) = pos[e['from']], pos[e['to']]
        p = ease_in_out(prog(t, at(e, 0.6), 0.6))
        if p <= 0: continue
        off = e.get('voff', 120)
        y1b, y2b = y1 + off, y2 - off
        arrow(c, x1, y1b, x2, y2b, P(e.get('color', ac)), 12, 32, progress=p)
        if e.get('cut') and t > at(e, 0.6) + e.get('cut_at', 0.6):
            pc = ease_back(prog(t, at(e, 0.6) + e.get('cut_at', 0.6), 0.3)); my = (y1b + y2b) / 2
            c.save(); pop_scale(c, x1, my, pc)
            circle(c, x1, my, 40, P('red'), shadow=True, stroke=(P('navy'), 5))
            line(c, x1 - 15, my - 15, x1 + 15, my + 15, P('paper'), 9); line(c, x1 + 15, my - 15, x1 - 15, my + 15, P('paper'), 9)
            c.restore()
        if e.get('label') and p > 0.5:
            label_chip(c, e['label'].upper(), x1 + 210, (y1b + y2b) / 2 + 12, 30, e.get('chip', 'navy'), 'paper',
                       ease_out(prog(t, at(e, 0.6) + 0.3, 0.3)))
        if e.get('coins') and p >= 1 and not e.get('cut'):
            for k in range(3):
                u = ((t - at(e, 0.6) - 0.6) * 0.7 + k / 3) % 1.0
                I.coin(c, x1 + math.sin(u * math.pi) * 40, lerp(y1b, y2b, u), 50)
    for nd in nodes:
        x, y = pos[nd['id']]
        p = prog(t, at(nd, 0.1), 0.45)
        if p <= 0: continue
        c.save(); pop_scale(c, x, y, p)
        if nd.get('icon'):
            I.icon(c, nd['icon'], x, y, nd.get('vsize', 170), t=t, **nd.get('kw', {}))
        else:
            circle(c, x, y, 95, P(nd.get('color', 'paper')), shadow=True, stroke=(P('navy'), 6))
            draw_text(c, nd['text'], x, y + 18, fit_font(nd['text'], FONT_HEAD, 52, 160), P('navy'))
        c.restore()
        if nd.get('label'):
            label_chip(c, nd['label'].upper(), x - 250 if nd.get('lside', 'left') == 'left' else x + 250, y + 12, 32,
                       nd.get('chip', 'navy'), 'paper', ease_out(prog(t, at(nd, 0.1) + 0.2, 0.3)))

def V_house(c, t, d, sp):
    bg, fg, ac = colors(sp)
    vheader(c, t, sp)
    p = ease_back(prog(t, 0.1, 0.5))
    c.save(); pop_scale(c, CX, 520, p); I.house(c, CX, 520, 320); c.restore()
    if sp.get('tag'):
        label_chip(c, sp['tag'].upper(), CX, 800, 38, 'gold', 'navy', ease_out(prog(t, 0.5, 0.3)), FONT_HEAD)
    pb = prog(t, sp.get('bank_at', 1.0), 0.5)
    c.save(); pop_scale(c, CX, 1130, pb); I.building(c, CX, 1130, 250, label='BANK'); c.restore()
    pa = prog(t, sp.get('pay_at', 2.0), 0.6)
    arrow(c, CX, 860, CX, 990, P('gold'), 12, 32, progress=ease_in_out(pa))
    if pa >= 1:
        for k in range(3):
            u = ((t - sp.get('pay_at', 2.0) - 0.6) * 0.7 + k / 3) % 1
            I.coin(c, CX + 120 + math.sin(u * math.pi) * 30, lerp(850, 1000, u), 48)
        label_chip(c, sp.get('pay_label', 'THE HOUSE PAYS').upper(), CX - 230, 930, 34, 'navy', 'gold',
                   ease_out(prog(t, sp.get('pay_at', 2.0) + 0.3, 0.3)), FONT_HEAD)

def V_pair(c, t, d, sp):
    bg, fg, ac = colors(sp)
    vheader(c, t, sp)
    for k, side in enumerate(('a', 'b')):
        s_ = sp[side]; y = 560 + k * 520
        p = ease_back(prog(t, at(s_, 0.2 + k), 0.45))
        if p <= 0: continue
        c.save(); pop_scale(c, CX, y, p)
        rrect(c, CX - 380, y - 170, 760, 340, 34, P(s_.get('color', 'paper')), shadow=True, stroke=(P('navy'), 7))
        draw_text(c, s_['top'].upper(), CX, y - 85, fit_font(s_['top'].upper(), FONT_HEAD, 48, 680), P('navy' if s_.get('color', 'paper') != 'navy' else 'paper'))
        draw_text(c, s_['value'], CX, y + 105, fit_font(s_['value'], FONT_NUM, 160, 680), P(s_.get('vcolor', 'navy')))
        c.restore()
    pa = prog(t, at(sp['b'], 1.2) - 0.4, 0.4)
    arrow(c, CX, 745, CX, 890, P(ac), 14, 36, progress=ease_out(pa))

def V_pie(c, t, d, sp):
    bg, fg, ac = colors(sp)
    vheader(c, t, sp)
    cx, cy, r = CX, 690, 270
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
        pl = ease_out(prog(t, at(s_, 0.2 + i * 0.5) + 0.2, 0.4))
        ly = 1050 + i * 85
        rrect(c, 140, ly - 30, 50, 50, 10, P(s_['color']), pl, shadow=True, stroke=(P('navy'), 4))
        draw_text(c, s_['label'].upper(), 215, ly + 8, fit_font(s_['label'].upper(), FONT_HEAD, 44, 720), P(fg), 'left', alpha=pl)
        start += sweep
    if sp.get('center'):
        pc = ease_back(prog(t, sp.get('center_at', 0.8), 0.4))
        c.save(); pop_scale(c, cx, cy, pc)
        circle(c, cx, cy, r * 0.42, P(bg), stroke=(P('navy'), 6))
        draw_text(c, sp['center'], cx, cy + 36, fit_font(sp['center'], FONT_NUM, 100, r * 0.75), P(fg))
        c.restore()

def V_doc(c, t, d, sp):
    bg, fg, ac = colors(sp)
    vheader(c, t, sp)
    p = ease_back(prog(t, 0.0, 0.5))
    c.save(); pop_scale(c, CX, 600, p)
    I.document(c, CX, 600, sp.get('size', 520), title=sp.get('doc_title', ''), stamp=sp.get('stamp'),
               stamp_color=sp.get('stamp_color', 'red'), p_stamp=prog(t, sp.get('stamp_at', 1.0), 0.35))
    c.restore()
    if sp.get('caption'):
        f = font(FONT_HEAD, sp.get('cap_size', 64))
        lines = []
        for part in sp['caption'].split('\n'):
            lines += wrap(part.upper(), f, MAXW)
        for i, ln in enumerate(lines):
            pi = ease_out(prog(t, sp.get('cap_at', 0.4) + i * 0.12, 0.4))
            col = P(ac) if i in sp.get('hl_lines', []) else P(fg)
            draw_text(c, ln, CX, 1000 + i * f.getSize() * 1.12, f, col, alpha=pi, shadow=True)

def V_calendar(c, t, d, sp):
    bg, fg, ac = colors(sp)
    p = ease_back(prog(t, 0.0, 0.45))
    c.save(); pop_scale(c, CX, 560, p)
    I.calendar(c, CX, 560, 360, month=sp.get('month', 'JAN'), year=str(sp.get('year', '2005')), color=sp.get('cal_color', 'red'))
    c.restore()
    if sp.get('caption'):
        f = font(FONT_HEAD, sp.get('cap_size', 72))
        lines = []
        for part in sp['caption'].split('\n'):
            lines += wrap(part.upper(), f, MAXW)
        for i, ln in enumerate(lines):
            pi = ease_out(prog(t, sp.get('cap_at', 0.35) + i * 0.12, 0.4))
            col = P(ac) if i == sp.get('hl_line', -1) else P(fg)
            draw_text(c, ln, CX, 900 + i * f.getSize() * 1.12, f, col, alpha=pi, shadow=True)

def V_icons(c, t, d, sp):
    bg, fg, ac = colors(sp)
    vheader(c, t, sp)
    items = sp['items']; n = len(items)
    top = 560 if sp.get('title') else 470
    gap = min(380, (1180 - top) / max(1, n - 1)) if n > 1 else 0
    y0 = top if n > 1 else 700
    for i, it in enumerate(items):
        y = y0 + i * gap
        p = prog(t, at(it, 0.1 + i * 0.25), 0.45)
        if p <= 0: continue
        ix = CX - 180 if it.get('label') else CX
        c.save(); pop_scale(c, ix, y, p)
        I.icon(c, it['icon'], ix, y, it.get('vsize', 200), t=t, **it.get('kw', {}))
        c.restore()
        if it.get('label'):
            pl = ease_out(prog(t, at(it, 0.1 + i * 0.25) + 0.15, 0.35))
            f = fit_font(it['label'].upper(), FONT_HEAD, 52, 420)
            draw_text(c, it['label'].upper(), CX - 40, y + 18, f, P(it.get('label_color', fg)), 'left', alpha=pl, shadow=True)

def V_follow(c, t, d, sp):
    """End card: full video on the channel + follow."""
    bg, fg, ac = colors(sp)
    p = ease_out(prog(t, 0.1, 0.4))
    f = font(FONT_HEAD, 84)
    for i, ln in enumerate(wrap(sp.get('text', 'Full video on the channel').upper(), f, MAXW)):
        draw_text(c, ln, CX, 420 + i * 92, f, P(fg if i == 0 else ac), alpha=p, shadow=True)
    pb = ease_back(prog(t, 0.4, 0.5))
    c.save(); pop_scale(c, CX, 820, pb)
    rrect(c, CX - 330, 740, 660, 170, 85, P('red'), shadow=True, stroke=(P('navy'), 7))
    draw_text(c, 'SUBSCRIBE', CX, 850, font(FONT_HEAD, 84), P('paper'))
    c.restore()
    pi = ease_back(prog(t, 0.8, 0.5))
    c.save(); pop_scale(c, CX, 1110, pi); I.coin(c, CX, 1110, 200); c.restore()

TEMPLATES_V = {'question': V_question, 'bignum': V_bignum, 'flow': V_flow, 'house': V_house, 'pair': V_pair,
               'pie': V_pie, 'doc': V_doc, 'calendar': V_calendar, 'icons': V_icons, 'follow': V_follow}
