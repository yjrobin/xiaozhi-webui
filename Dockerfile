
# Build frontend
FROM node:18 as frontend

WORKDIR /app/frontend

COPY frontend/package.json ./


RUN npm install

COPY frontend/ .

RUN npm run build

# Build backend
FROM python:3.9-slim

WORKDIR /app

COPY backend/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend /app/frontend/dist ./frontend/dist

EXPOSE 8000

CMD ["python", "main.py"]
