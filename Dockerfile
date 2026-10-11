# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24-bookworm-slim
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build

FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev && npm cache clean --force

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production LISTEN_HOST=0.0.0.0 PORT=3000 DATABASE_PATH=/app/data/codevista.sqlite
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json LICENSE ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/web-dist ./web-dist
COPY schemas ./schemas
RUN mkdir -p /app/data && chown node:node /app/data && chmod 700 /app/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/server/main.js"]
