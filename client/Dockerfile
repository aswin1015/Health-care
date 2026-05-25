# Build stage — React JSX SPA
FROM node:20-alpine AS builder

WORKDIR /usr/src/app/client

COPY client/package*.json ./
RUN npm install

COPY client/index.html ./
COPY client/vite.config.js ./
COPY client/tsconfig.json ./
COPY client/src/ ./src/

RUN npm run build

# ── Nginx static server stage ─────────────────────────────────────────────────
FROM nginx:alpine

COPY client/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /usr/src/app/client/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
