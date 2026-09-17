FROM mcr.microsoft.com/playwright:v1.58.2-noble
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY *.mjs ./
ENV NODE_ENV=production BOT_HOST=0.0.0.0 BOT_PORT=8094 BOT_DATA_DIR=/data
RUN mkdir -p /data && chown pwuser:pwuser /data
USER pwuser
EXPOSE 8094
CMD ["node", "server.mjs"]
