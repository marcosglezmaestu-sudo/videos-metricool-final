#!/usr/bin/env bash
# Full pipeline for one Cubed Kitchen video.
# usage: ./make_video.sh <jobdir> [food name]      (food is picked at random among unused ones if omitted)
# output: <jobdir>/final.mp4 (1080x1920, >= 60 s: 1 s hook + 76.4 s), <jobdir>/meta.json
set -euo pipefail
cd "$(dirname "$0")"
JOB="$1"; FOOD="${2:-}"
mkdir -p "$JOB"
HIST=../history.json; [ -f "$HIST" ] || echo '[]' > "$HIST"
[ -f "$JOB/food.json" ] || python3 pick_food.py foods.json "$HIST" "$JOB/food.json" ${FOOD:+"$FOOD"}
echo "== physics"; [ -f "$JOB/sim.json" ] || node simulate.js "$JOB/food.json" "$JOB"
echo "== render (about 1 h 45 min, resumable: re-run the same command to continue)"; node render.cjs full "$JOB" >> "$JOB/render.log" 2>&1
grep -q RENDER_DONE "$JOB/render.log"
ls "$JOB"/seg_*.mp4 | sort -V | sed "s#.*/#file #" > "$JOB/segs.txt"
ffmpeg -y -v error -f concat -safe 0 -i "$JOB/segs.txt" -c copy "$JOB/main.mp4"
echo "== audio"; python3 audio.py "$JOB"
echo "== assemble"
ffmpeg -y -v error -i "$JOB/hook.mp4" -i "$JOB/main.mp4" -i "$JOB/final.wav" \
  -filter_complex "[0:v][1:v]concat=n=2:v=1:a=0,scale=1080:1920:flags=lanczos,format=yuv420p[v]" \
  -map "[v]" -map 2:a -c:v libx264 -preset veryfast -crf 18 -af "loudnorm=I=-17:TP=-2:LRA=11" -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$JOB/final.mp4"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$JOB/final.mp4")
python3 - "$JOB" "$DUR" <<'P'
import json, sys
job, dur = sys.argv[1], float(sys.argv[2])
f = json.load(open(f'{job}/food.json'))
assert dur >= 60, f'video too short: {dur}'
json.dump({'food': f['name'], 'duration': round(dur, 2)}, open(f'{job}/meta.json', 'w'))
print('VIDEO_OK', f['name'], round(dur, 2), 's')
P
ffmpeg -y -v error -i "$JOB/final.mp4" -vf "fps=1/5,scale=120:-1,tile=8x2" -frames:v 1 "$JOB/contact.jpg"
