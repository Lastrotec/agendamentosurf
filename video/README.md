# Vídeos "Como instalar" (iPhone e Android)

Gravados a partir de telas reais do app (celular emulado) com a barra do Safari/Chrome reproduzida,
toques animados e legendas. Saída em `public/videos/` (MP4 H.264 ≈ 280 KB, pôster JPG e legendas VTT).

Para regravar (com o app rodando em `npm run cf:dev` na porta 8790):
```bash
node video/capture.cjs   # captura as telas do app (iphone-*.jpg / android-*.jpg)
node video/record.cjs    # grava install.html#android e #iphone
```
Depois converta os .webm para MP4 com o ffmpeg (comandos em `record.cjs`).
