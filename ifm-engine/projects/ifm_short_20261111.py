# IFM Short 2026-11-11 — Alf Common, the first £1,000 footballer (1905)
TITLE = "The First £1,000 Footballer Shocked England"
OUTNAME = 'IFM_short_20261111_first_1000_footballer'
FORMAT = 'vertical'
VOICE = "bm_fable"
SPEED = 1.30

BEATS = [
dict(text="In 1905, one footballer cost a thousand pounds, and England was outraged.",
     scene=dict(type='question', bg='red', text="The first £1,000 footballer", hl=['£1,000'], accent='gold',
                icon='coins', icon_kw=dict(n=5), icon_size=380)),
dict(text="His name was Alf Common, a striker at Sunderland.",
     scene=dict(type='icons', bg='navy', items=[
         dict(icon='shirt', label='Alf Common', vsize=180, at=0.0, kw=dict(color='red', trim='white', text='COMMON', number='9')),
         dict(icon='stadium', label='Sunderland', vsize=120, at='Sunderland')])),
dict(text="Just six months earlier, Sunderland had signed him for a record 520 pounds.",
     scene=dict(type='bignum', bg='green', value=520, prefix='£', num_at='520', label='Record fee, 1904',
                sub='Sheffield United to Sunderland', icon='coins', icon_kw=dict(n=3), icon_size=280)),
dict(text="Then Middlesbrough, fighting relegation, paid almost double.",
     scene=dict(type='pair', bg='gold',
                a=dict(top='1904', value='£520', color='paper', at=0.1),
                b=dict(top='February 1905', value='£1,000', color='navy', vcolor='gold', at='double'))),
dict(text="One journalist called it flesh and blood for sale.",
     scene=dict(type='doc', bg='paper', doc_title='PRESS, 1905', stamp='OUTRAGE', stamp_at='flesh',
                caption="'Flesh and blood\nfor sale'", hl_lines=[0, 1], accent='red', cap_at=0.3)),
dict(text="And Common himself? Under the maximum wage, he officially got a ten pound signing-on fee.",
     scene=dict(type='bignum', bg='navy', value=10, prefix='£', num_at='ten', label="The player's official cut",
                sub='Maximum wage rules', icon='person', icon_size=300)),
dict(text="On his debut, he scored the only goal, from the penalty spot. Middlesbrough's first away win in nearly two years.",
     scene=dict(type='calendar', bg='sky', month='FEB', year='1905', caption="Debut: 1-0 win\nFirst away win\nin ~2 years",
                hl_line=0, accent='gold', cal_color='red')),
dict(text="And they stayed up.",
     scene=dict(type='question', bg='green', text="Middlesbrough stayed up", hl=['STAYED', 'UP'], accent='gold', size=82,
                icon='trophy', icon_size=360)),
dict(text="Fees kept rising. So in 1908, the Football League capped transfers at 350 pounds.",
     scene=dict(type='bignum', bg='red', value=350, prefix='£', num_at='350', label='Transfer fee limit, 1908',
                sub='Set by the Football League', icon='padlock', icon_size=280, accent='gold')),
dict(text="Clubs got round it by selling players in bundles. The cap lasted about a year.",
     scene=dict(type='flow', bg='paper', nodes=[
         dict(id='sell', icon='shirt', kw=dict(color='sky', text='SELLER', number='£'), label='Selling club', vsize=180, at=0.0),
         dict(id='pl', icon='players', kw=dict(color='sky'), label='3 x £350', vsize=200, at='bundles'),
         dict(id='buy', icon='shirt', kw=dict(color='red', text='BUYER', number='£'), label='Buying club', vsize=180, at='bundles')],
         edges=[dict(**{'from': 'sell', 'to': 'pl'}, at='selling'),
                dict(**{'from': 'pl', 'to': 'buy'}, coins=True, at='bundles', label='Star + 2')])),
dict(text="Today, the best-paid stars earn a thousand pounds in well under an hour.",
     scene=dict(type='question', bg='navy', text="£1,000 today: under an hour of wages", hl=['£1,000', 'HOUR'], accent='gold',
                icon='note', icon_size=320)),
dict(text="More football money stories? Full videos on the channel.", pause=1.6,
     scene=dict(type='follow', bg='navy', text='Full videos on the channel')),
]
