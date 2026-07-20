# Web image — builds the SPA and serves it via nginx, reverse-proxying /api to
# the API container. BUILD CONTEXT MUST BE THE REPO ROOT:
#   docker build -f infra/web.Dockerfile -t moca-web .
FROM node:20-alpine AS build
WORKDIR /app
COPY app/package*.json ./
RUN npm ci
COPY app/ .
# API is same-origin under /api (nginx proxies it), so the SPA base is root.
ENV VITE_BASE=/
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
