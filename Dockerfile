# syntax=docker/dockerfile:1
# Production image: the Angular build served by scripts/serve-prod.mjs, which also proxies /api
# and /actuator/health to API_URL (same origin for the browser) and sends the security headers.
#   docker build -t pharmacy-core-web . && docker run -p 4300:4300 -e API_URL=http://host.docker.internal:8080 pharmacy-core-web

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
# npm install, not npm ci: the lock file is written on Windows and lacks Linux-only optional
# packages (@emnapi/*), which npm ci refuses; everything else still installs at the locked versions.
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:22-alpine
WORKDIR /app
COPY --from=build /src/dist/pharmacy-core-web/browser ./dist/pharmacy-core-web/browser
COPY --from=build /src/scripts/serve-prod.mjs ./scripts/serve-prod.mjs
USER node
ENV PORT=4300 API_URL=http://localhost:8080
EXPOSE 4300
CMD ["node", "scripts/serve-prod.mjs"]
