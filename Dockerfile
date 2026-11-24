# syntax=docker/dockerfile:1
# Production image: the Angular build served by scripts/serve-prod.mjs, which also proxies /api
# and /actuator/health to API_URL (same origin for the browser) and sends the security headers.
#   docker build -t pharmacy-core-web . && docker run -p 4300:4300 -e API_URL=http://host.docker.internal:8080 pharmacy-core-web

# ---- build ----
FROM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS build
WORKDIR /src
COPY package.json package-lock.json ./
# Exactly the locked versions (checked to install on Linux; base images pinned by digest, kept
# current by Dependabot).
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5
WORKDIR /app
COPY --from=build /src/dist/pharmacy-core-web/browser ./dist/pharmacy-core-web/browser
COPY --from=build /src/scripts/serve-prod.mjs ./scripts/serve-prod.mjs
# The server needs only node: npm, npx and corepack (and their bundled packages, which the image
# scan flags) are removed from the runtime image.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack     /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
USER node
ENV PORT=4300 API_URL=http://localhost:8080
EXPOSE 4300
CMD ["node", "scripts/serve-prod.mjs"]
