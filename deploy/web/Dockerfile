# Web app image, built from THIS repository's own source.
#
# The previous image was built elsewhere and cloned this repo at
# build time, which meant it needed a cross-repo token for a private repository.
# No pipeline had one, so the image was only ever built by hand and production
# silently served a frontend days behind main. Building here removes the clone,
# the token, and the drift: the build context IS the commit being built.
FROM node:20-alpine AS builder

WORKDIR /app

# Electron binaries are useless for a web build and slow/fragile to fetch.
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1

# Install dependencies first so this layer is reused when only sources change.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

RUN npm run build:web

# Production stage
FROM nginx:alpine

# web.vite.config.mts builds to web/dist
COPY --from=builder /app/web/dist /usr/share/nginx/html

# Rendered by nginx's envsubst entrypoint, so DYNADOC_API_BASE is substituted.
COPY deploy/web/nginx.conf /etc/nginx/templates/default.conf.template

ENV DYNADOC_API_BASE=https://api.dynadoc.dashmake.com

EXPOSE 80
