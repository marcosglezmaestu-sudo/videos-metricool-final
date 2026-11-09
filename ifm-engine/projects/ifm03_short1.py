# IFM Short #1 (from video #3) — How the Glazers bought Manchester United with borrowed money
TITLE = "They Bought Man United With Its Own Money"
OUTNAME = 'IFM03_short1_glazers_borrowed_money'
FORMAT = 'vertical'
VOICE = "bm_fable"
SPEED = 1.18

BEATS = [
dict(text="Manchester United was bought with money the club had to pay back itself.",
     scene=dict(type='question', bg='red', text="Bought with its own money", hl=['OWN', 'MONEY'], accent='gold',
                icon='shirt', icon_kw=dict(color='red', text='MAN UTD', number='£', text_color='paper'), icon_size=420)),
dict(text="In 2005, the Glazer family bought the club for 790 million pounds.",
     scene=dict(type='bignum', bg='navy', value=790, prefix='£', suffix='M', num_at='790', label='Manchester United, 2005',
                sub='Bought by the Glazer family', icon='calendar', icon_kw=dict(month='JUN', year='2005', color='red'), icon_size=300)),
dict(text="But most of that money wasn't theirs.",
     scene=dict(type='question', bg='gold', text="Most of the money wasn't theirs", hl=["WASN'T", 'THEIRS'], accent='paper', icon='question', icon_size=360)),
dict(text="They borrowed it, and then they moved the debt onto the club itself.",
     scene=dict(type='flow', bg='paper', title='Leveraged buyout', nodes=[
         dict(id='bank', icon='building', kw=dict(label='BANK'), label='Lenders', vsize=190, at=0.0),
         dict(id='own', icon='person', label='Buyer', vsize=210, at='borrowed'),
         dict(id='club', icon='shirt', kw=dict(color='red', text='DEBT', number='£'), label='The club', vsize=210, at='debt')],
         edges=[dict(**{'from': 'bank', 'to': 'own'}, coins=True, at='borrowed'),
                dict(**{'from': 'own', 'to': 'club'}, color='red', at='debt', label='Debt')])),
dict(text="It's like buying a house with a loan, and making the house pay the mortgage.",
     scene=dict(type='house', bg='sky', bank_at='loan', pay_at='house pay', tag='Your new house')),
dict(text="Before the takeover, United had no debt. After it, the club owed hundreds of millions.",
     scene=dict(type='pair', bg='red', a=dict(top='Before 2005', value='£0 DEBT', color='paper', at=0.2),
                b=dict(top='After', value='£100s OF M', color='navy', vcolor='gold', at='After'))),
dict(text="Finance expert Kieran Maguire estimated that by 2023, United had paid around 900 million pounds in interest.",
     scene=dict(type='bignum', bg='navy', value=900, prefix='£', suffix='M', num_at='900', label='Interest paid since 2005',
                sub='Estimate by Kieran Maguire, 2023', icon='debt', icon_size=280)),
dict(text="Money that went to lenders, not to players.",
     scene=dict(type='flow', bg='gold', nodes=[
         dict(id='club', icon='shirt', kw=dict(color='red'), vsize=200, at=0.0),
         dict(id='bank', icon='building', kw=dict(label='BANK'), label='Lenders', vsize=180, at='lenders'),
         dict(id='pl', icon='players', kw=dict(color='red'), label='Players', vsize=200, at='players')],
         edges=[dict(**{'from': 'club', 'to': 'bank'}, coins=True, at='lenders'),
                dict(**{'from': 'bank', 'to': 'pl'}, cut=True, cut_at=0.3, color='paper', at='players')])),
dict(text="Today, Jim Ratcliffe owns about 29 per cent and runs the football side. But the Glazers still hold the biggest stake.",
     scene=dict(type='pie', bg='paper', title='Man United today (approx.)', slices=[
         dict(label='Glazer family ~49%', value=49, color='red', at=0.2),
         dict(label='Jim Ratcliffe ~29%', value=29, color='sky', at='Ratcliffe'),
         dict(label='Other shareholders', value=22, color='grey', at='football')], center='~29%', center_at='29')),
dict(text="Who really owns your club? The full video is on our channel.", pause=1.6,
     scene=dict(type='follow', bg='navy', text='Who owns your club? Full video on the channel')),
]
