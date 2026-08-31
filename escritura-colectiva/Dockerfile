FROM python:3.13-alpine

WORKDIR /app

ENV COLLECTIVE_SCROLL_DATA=/data
ENV PORT=8080
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY app.py /app/app.py
COPY public /app/public

RUN adduser -D appuser \
  && mkdir -p /data \
  && chown -R appuser:appuser /app /data

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/healthz', timeout=8).read()" || exit 1

CMD ["python", "/app/app.py"]
