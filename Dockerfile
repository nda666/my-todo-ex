# Stage 1: Build Frontend (Vite + React)
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend (Go)
FROM golang:alpine AS backend-builder

WORKDIR /app/backend

RUN apk add --no-cache git ca-certificates

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/server .

# Stage 3: Production All-in-One Runner
FROM alpine:3.21

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

# Copy Go server binary
COPY --from=backend-builder /app/server /app/server

# Copy Frontend static production bundle into dist/
COPY --from=frontend-builder /app/frontend/dist /app/dist

ENV PORT=8080
EXPOSE 8080

CMD ["/app/server"]
