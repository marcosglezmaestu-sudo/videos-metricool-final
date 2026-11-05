# Cubed Kitchen — generador de vídeos

- `scene2.js` + `index2.html`: formato completo de 6 rondas (10/50/100/250/500/1000 cortes), HUD CUTS/CUBES, cocina minimalista.
- `sim.js`: simulación física (Rapier) de la caída de cubos → `sim.json` + `sim.bin`.
- `scene3.js` + `index3.html`: render de la caída con física real (piezas = caja ∩ elipsoide, sombras reales).
- `render.js`: `PAGE=<page>.html node render.js full out.mp4` | `preview f1,f2` | `events out.json`.
- `audio2.py` / `audio3.py`: sonido ASMR sintetizado (cortes + choques).

Requisitos: Node 22, `npm i three puppeteer-core @dimforge/rapier3d-compat`, Google Chrome, ffmpeg, Python con numpy+scipy.
