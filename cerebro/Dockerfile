FROM python:3.12-slim

# Evitar .pyc y buffering (logs en vivo)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY cerebro_server.py .

# Cloud Run inyecta $PORT (por defecto 8080)
ENV PORT=8080
EXPOSE 8080

CMD exec uvicorn cerebro_server:app --host 0.0.0.0 --port ${PORT}
