# data-app/Dockerfile
# La data app est un SPA statique : on build avec Node, on sert avec nginx.
# Image finale ~25 MB.

# ── Étape 1 : build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
# → génère /app/dist avec index.html + assets

# ── Étape 2 : servir les fichiers statiques ──────────────────────────────────
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html

# Config nginx pour SPA : toutes les routes non trouvées → index.html
# (nécessaire pour React Router)
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
