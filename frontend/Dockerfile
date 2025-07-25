
# build stage
FROM node:18-alpine as build-stage
WORKDIR /app
COPY frontend/package.json ./
RUN npm install && printenv
COPY frontend/ .
RUN npm run build

# production stage
FROM nginx:stable-alpine as production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html/xiaozhi-webui
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
