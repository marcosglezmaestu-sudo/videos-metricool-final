"""Title / captions for a food. usage: python3 caption.py "<Food Name>" -> JSON"""
import json, sys
food = sys.argv[1]
art = 'an' if food[0].lower() in 'aeiou' else 'a'
low = food.lower()
tag = ''.join(w.capitalize() for w in food.split())
print(json.dumps({
  'title': f'1,000 Cuts on {art} {food} 🔪 How Many Cubes?',
  'description': f'1,000 cuts on {art} {low} 🔪 How many cubes do you think? Drop your guess 👇\n\n#satisfying #asmr #oddlysatisfying #cutting #shorts',
  'tiktok_title': f'1,000 cuts on {art} {low} 🔪',
  'tiktok_text': f'1,000 cuts on {art} {low} 🔪 How many cubes do you think? 👇 #satisfying #asmr #oddlysatisfying',
  'tags': ['satisfying', 'asmr', 'oddly satisfying', 'cutting', low, '3d animation', 'cubes', 'cubed kitchen'],
}, ensure_ascii=False))
