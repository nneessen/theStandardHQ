FROM python:3.11-slim

# ffmpeg/ffprobe are the whole point of this worker — mute PII spans in call audio.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

ENV PORT=8000
EXPOSE ${PORT}

# Railway injects $PORT — shell form so it expands at runtime.
CMD uvicorn app:app --host 0.0.0.0 --port ${PORT} --workers 2 --timeout-keep-alive 300
