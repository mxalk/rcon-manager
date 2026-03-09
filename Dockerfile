FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json

RUN npm ci

COPY tsconfig.base.json ./
COPY server ./server
COPY client ./client

RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/data

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json

RUN npm ci --omit=dev

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

RUN mkdir -p /data && chown -R node:node /app /data

USER node

EXPOSE 3001
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:3001/api/health').then((res)=>process.exit(res.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/dist/index.js"]
