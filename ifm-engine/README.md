# IFM video engine

Motor de vídeo de **Inside Football Money** (vídeos largos 16:9, estilo infografía Tifo/Athletic).
Lo usa la skill `ifm-video-largo`.

- `draw.py`: primitivas, paleta IFM, grano, marca de agua y mapa.
- `icons.py`: iconos planos 2D dibujados en código.
- `scenes.py`: plantillas de escena (chapter, bignum, map, flow, pie, photo…).
- `build.py`: voz Kokoro, línea de tiempo, efectos, render en paralelo, .srt y capítulos.
- `projects/ifm03.py`: ejemplo completo ("Who Really Owns Your Football Club?", 8:44).
- `fonts/`: Montserrat, Anton e Inter (SIL Open Font License). `world.json`: Natural Earth 110m (dominio público).

Uso:

    python3 build.py projects/<slug>.py ~/ifm/out/<slug>                 # voz + línea de tiempo
    python3 build.py projects/<slug>.py ~/ifm/out/<slug> --preview 0,1,2 # fotogramas de prueba
    python3 build.py projects/<slug>.py ~/ifm/out/<slug> --render        # MP4 final

El modelo de voz (Kokoro) se descarga en `../tts/` (ver la skill).
