# Vídeos da Outside (logo oficial)

- `public/videos/como-instalar-{iphone,android}.mp4` — passo a passo de instalação (≈320 KB cada, com pôster e legendas VTT).
- `video/entregas/outside-comercial.mp4` — comercial vertical 1080×1920, ~19 s: abertura com a onda (logo laranja → branca),
  telas reais do app (início, agendamento, previsão do mar, Pix) e chamada final. Capa: `outside-comercial-capa.jpg`.

Feitos a partir de telas reais do app (celular emulado) com a barra do Safari/Chrome reproduzida.
Para regravar: suba o app (`npm run cf:dev`, porta 8790), rode `node video/capture.cjs`, sirva a pasta `video/`
em `http://127.0.0.1:8977` (ex.: `python3 -m http.server 8977`) e rode `node video/record.cjs` e `node video/rec-commercial.cjs`.
Converta os `.webm` para MP4 com o ffmpeg (`-c:v libx264 -crf 22 -pix_fmt yuv420p -movflags +faststart`).
