"""Append a published video to ../history.json.
usage: python3 record.py <jobdir> <YYYY-MM-DD> <slot 13|17|20> <title> <metricool uuid> <plannerUrl>"""
import json, sys, os
job, date, slot, title, uuid, planner = sys.argv[1:7]
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'history.json')
hist = json.load(open(path)) if os.path.exists(path) else []
meta = json.load(open(os.path.join(job, 'meta.json')))
hist.append({'food': meta['food'], 'date': date, 'slot': int(slot), 'title': title, 'duration': meta['duration'],
             'metricool': {'uuid': uuid, 'plannerUrl': planner}})
json.dump(hist, open(path, 'w'), ensure_ascii=False, indent=1)
print('history:', len(hist), 'videos')
