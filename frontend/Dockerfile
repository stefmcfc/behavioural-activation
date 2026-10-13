# Build stage: produces the static Vite bundle.
FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage: nginx serves the static bundle and reverse-proxies /api/ to the backend
# Compose service, keeping the browser on a single origin -- see tooling_spec_006's Decision 2.
FROM nginx:alpine
COPY --from=build /workspace/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
