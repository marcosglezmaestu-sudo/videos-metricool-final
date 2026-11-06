# Tarea programada — Cubed Kitchen (1 vídeo por franja)

Variables que da el aviso programado: **FRANJA** = 10, 14 o 19 (hora de publicación, Europe/Madrid).
Responde siempre en español de España. Trabaja solo; no preguntes nada.

## 0. Preparación
- Si existe la skill `cubed-kitchen-video`, cárgala con la herramienta Skill (reglas del formato).
- El repo ya está clonado en `~/vmf` (lo hace el aviso). `cd ~/vmf/cubed-kitchen/gen && npm i --silent`.
- `git config user.email marcos.glezmaestu@gmail.com && git config user.name Marcos`.
- HOY = fecha de Madrid (`TZ=Europe/Madrid date +%F`). Si `../history.json` ya tiene un vídeo con `date` = HOY y `slot` = FRANJA, termina sin hacer nada.

## 1. Generar el vídeo (≈2 h)
- `nohup ./make_video.sh ~/job > ~/job.log 2>&1 &` (elige sola una comida al azar que no esté en el historial).
- Espera en tramos de ≤ 10 min con `sleep 540; tail -3 ~/job.log; grep -E '^frame' ~/job/render.log | tail -1`.
  **No** esperes con `pgrep -f make_video` (se encuentra a sí mismo).
- Termina cuando `~/job.log` contenga `VIDEO_OK` (o un error).
- El render es **reanudable**: si el proceso desaparece (reinicio del entorno) sin `VIDEO_OK`, vuelve a lanzar exactamente el mismo comando; sigue desde la última ronda terminada (archivos `~/job/seg_<n>.done`).
- Si sale `NO_FOODS_LEFT`: inventa una comida nueva (distinta de todas las de `foods.json` e historial) con el mismo esquema JSON que las demás (shape, R, skin, flesh, core…), añádela a `foods.json` y relanza.
- Si falla, lee el error, corrígelo si es algo puntual y relanza **una** vez. Si vuelve a fallar, avisa a Marcos (paso 6) y no publiques.

## 2. Revisar
- `Read ~/job/contact.jpg`: debe verse la comida, el cuchillo, los contadores y los cubos cayendo. Si está negro o roto, no publiques y avisa.
- La duración (en `~/job/meta.json`) debe ser ≥ 60 s (el script ya lo comprueba).

## 3. Puente público y Metricool
- `URL=$(./bridge.sh push ~/job/final.mp4 ck-$(TZ=Europe/Madrid date +%Y%m%d)-FRANJA.mp4)` (rama `cubed`, push normal).
- `python3 caption.py "<comida>"` → título y textos.
- Carga Metricool con ToolSearch: `select:mcp__Metricool_Social_Media_Management__createScheduledPost`.
- Marca **Cubed Kitchen**: blogId `7902511`. Fecha: `HOYTFRANJA:00:00+01:00` (usa el desfase real de Madrid: +01:00 invierno, +02:00 verano) y `publicationDate {"dateTime":"HOYTFRANJA:00:00","timezone":"Europe/Madrid"}`.
  Si ya son más de FRANJA:00 menos 15 min, programa para dentro de 20 minutos y avísalo.
- **YouTube** primero (media = URL raw): `text` = description, `youtubeData {"title":<title>,"type":"short","privacy":"public","tags":<tags>,"category":"ENTERTAINMENT","madeForKids":false,"isAiGeneratedContent":false}`.
- **TikTok** después (media = la URL `static.metricool.com` que devuelve la de YouTube): `text` = tiktok_text, `tiktokData {"title":<tiktok_title>,"disableComment":false,"disableDuet":false,"disableStitch":false,"privacyOption":"PUBLIC_TO_EVERYONE","commercialContentThirdParty":false,"commercialContentOwnBrand":false,"autoAddMusic":false,"isAigc":false}`.
- Base de `info`: `{"autoPublish":true,"descendants":[],"draft":false,"firstCommentText":"","hasNotReadNotes":false,"media":[URL],"mediaAltText":[],"providers":[{"network":<red>}],"publicationDate":{...},"shortener":false,"smartLinkData":{"ids":[]},"text":...}`.
- Comprueba que cada respuesta da `PENDING` y media en `static.metricool.com`. Si una red falla, reintenta una vez.
- Después: `./bridge.sh clear`.

## 4. Historial (repo)
- `python3 record.py ~/job HOY FRANJA "<title>" <uuid YouTube> <plannerUrl YouTube>`.
- `cd ~/vmf && git add cubed-kitchen/history.json cubed-kitchen/gen/foods.json && git commit -qm "Cubed Kitchen: HOY FRANJA <comida>" && git pull -q --rebase origin main && git push -q origin HEAD:main`.

## 5. Panel (artifact `7c11a37b-8f1e-4436-873d-044fb933ec54`)
- `mkdir -p ~/panel/videos/HOY ~/panel/thumbs`. Vista previa ligera: `ffmpeg -y -i ~/job/final.mp4 -vf scale=540:960 -c:v libx264 -preset veryfast -crf 30 -c:a aac -b:a 96k -movflags +faststart ~/panel/videos/HOY/ck-FRANJA.mp4` y miniatura `ffmpeg -y -ss 40 -i ~/job/final.mp4 -frames:v 1 -vf scale=360:-1 ~/panel/thumbs/HOY-FRANJA.jpg`.
- `get_artifact` → versión; `read_file data/videos.json`; añade a `videos`:
  `{"date":HOY,"slot":FRANJA,"food":<comida>,"title":<title>,"duration":<s>,"status":"programado","preview":"videos/HOY/ck-FRANJA.mp4","thumb":"thumbs/HOY-FRANJA.jpg","metricool":{"uuid":...,"plannerUrl":...,"tiktok":{"uuid":...,"plannerUrl":...}}}`;
  pon `"updated"` (ISO, hora de Madrid) y `"foods"` = nombres de `foods.json`.
  Vídeos con más de 5 días: quita su `preview` y borra su mp4 del panel (`remove` en publish_files).
- `publish_files` en modo patch: primero el mp4 (una llamada), después la miniatura y al final `data/videos.json` (vuelve a hacer get_artifact antes de cada llamada). No toques `index.html`.

## 6. Aviso final
- `SendUserFile` con `~/job/final.mp4` y un `SendUserMessage` breve: comida, duración, hora programada, redes y cualquier problema.
