# Document conversion service (Word/PowerPoint <-> PDF, unlock/protect/compress).
#
# This is what runs on YOUR host in production (a VPS, Render, Railway, Fly.io,
# Cloud Run, ECS ...). Visitors to the website install nothing — their browser
# uploads the .docx here and gets the PDF back, exactly like iLovePDF.
#
#   docker build -t imresizer-convert ./server
#   docker run -p 5000:5000 imresizer-convert
#
# Then point the frontend at it:  VITE_API_URL=https://your-host

FROM python:3.12-slim-bookworm

# LibreOffice (Writer + Impress — the layout engines) + the metric-compatible
# font families it substitutes for Calibri / Cambria / Arial / Times / Courier,
# so documents look the same as they do in Word/PowerPoint even without MS fonts.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-writer \
      libreoffice-impress \
      libreoffice-calc \
      libreoffice-core \
      fonts-liberation \
      fonts-crosextra-carlito \
      fonts-crosextra-caladea \
      fonts-dejavu \
      fonts-noto-core \
      fonts-noto-cjk \
      libglib2.0-0 \
      libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY convert_server.py .

# Warm the LibreOffice profile once at build time so the first real request is fast.
RUN printf 'warmup' > /tmp/warmup.txt \
    && soffice --headless --convert-to pdf --outdir /tmp /tmp/warmup.txt || true

ENV PORT=5000
EXPOSE 5000

# 2 workers, long timeout (a big document can take a while), 1 request at a time
# per worker keeps LibreOffice happy.
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT} --workers 2 --timeout 180 convert_server:app"]
