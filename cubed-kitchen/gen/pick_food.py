"""Pick a random food never used before. usage: python3 pick_food.py <foods.json> <history.json> <out food.json> [name]"""
import json, random, sys, os
foods = json.load(open(sys.argv[1]))
hist = json.load(open(sys.argv[2])) if os.path.exists(sys.argv[2]) else []
used = {h['food'].lower() for h in hist}
if len(sys.argv) > 4:
    pick = next(f for f in foods if f['name'].lower() == sys.argv[4].lower())
else:
    free = [f for f in foods if f['name'].lower() not in used]
    if not free:
        print('NO_FOODS_LEFT'); sys.exit(3)   # the agent must author a new food spec (same schema) and add it to foods.json
    pick = random.choice(free)
json.dump(pick, open(sys.argv[3], 'w'), indent=1)
print(pick['name'], '| remaining after this:', len([f for f in foods if f['name'].lower() not in used]) - 1)
