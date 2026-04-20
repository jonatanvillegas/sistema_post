# Build frontend + install backend deps
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Frontend
COPY front/sistema-pos-front/package.json front/sistema-pos-front/package.json
COPY front/sistema-pos-front/package-lock.json front/sistema-pos-front/package-lock.json
RUN npm --prefix front/sistema-pos-front ci
COPY front/sistema-pos-front front/sistema-pos-front
RUN npm --prefix front/sistema-pos-front run build

# Backend
COPY backend/package.json backend/package.json
COPY backend/package-lock.json backend/package-lock.json
RUN npm --prefix backend ci --omit=dev
COPY backend backend

# Runtime
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/backend /app/backend
COPY --from=builder /app/front/sistema-pos-front/dist /app/front/sistema-pos-front/dist

EXPOSE 5000
CMD ["node", "backend/server.js"]
