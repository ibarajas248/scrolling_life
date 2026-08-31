FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV HOME=/tmp
ENV XDG_CONFIG_HOME=/tmp/.config
ENV STREAMLIT_BROWSER_GATHER_USAGE_STATS=false

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY app.py /app/app.py

RUN useradd --create-home --uid 10001 streamlit
USER streamlit

EXPOSE 8501

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8501/trafico/_stcore/health', timeout=3).read()"

CMD ["streamlit", "run", "/app/app.py", "--server.address=0.0.0.0", "--server.port=8501", "--server.baseUrlPath=trafico", "--server.headless=true"]
