FROM node:22-alpine

WORKDIR /app

RUN mkdir -p /data /seed

COPY package.json ./
RUN npm install --omit=dev

COPY server.mjs ./
COPY seed/grafo-3d.seed.json /seed/grafo-3d.seed.json

ENV NODE_ENV=production
ENV GRAPH_PORT=8092
ENV GRAPH_HOST=0.0.0.0
ENV GRAPH_DATA_PATH=/data/grafo-3d.local.json
ENV GRAPH_SEED_PATH=/seed/grafo-3d.seed.json

RUN addgroup -S app && \
    adduser -S app -G app && \
    chown -R app:app /app /data /seed

USER app

EXPOSE 8092

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8092/health >/dev/null || exit 1

CMD ["node", "server.mjs"]
