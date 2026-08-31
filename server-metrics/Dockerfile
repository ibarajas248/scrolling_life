FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV HOST_PROC=/host/proc
ENV HOST_ROOT=/host/root
ENV PORT=8091

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY app.py /app/app.py

RUN useradd --create-home --uid 10002 metrics
RUN mkdir -p /data && chown -R metrics:metrics /data
USER metrics

EXPOSE 8091

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8091/healthz', timeout=3).read()"

CMD ["python", "/app/app.py"]
