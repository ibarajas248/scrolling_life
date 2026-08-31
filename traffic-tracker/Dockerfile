FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8090

COPY package.json /app/package.json
RUN npm install --omit=dev

COPY server.js /app/server.js
COPY scripts /app/scripts

USER node

EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8090/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "/app/server.js"]
