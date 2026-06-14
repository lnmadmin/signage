# Signage — Digital Signage Platform

Monorepo for the digital signage system.

## Structure

| Package | Description |
|---|---|
| `backend` | NestJS API — TypeScript, Prisma, PostgreSQL |
| `cms-web` | Content Management System — React, TypeScript, Vite |
| `android-player` | Android player app (coming soon) |

## Prerequisites

- Node.js 20+
- npm 10+
- Docker & Docker Compose

## Quick Start

### 1. Start local services

```bash
docker compose up -d
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment

```bash
cp backend/.env.example backend/.env
```

### 4. Run database migrations

```bash
npm run db:migrate --workspace=backend
```

### 5. Start development servers

```bash
# Backend  →  http://localhost:3000
npm run backend

# CMS Web  →  http://localhost:5173
npm run cms-web
```

## Local Services

| Service | URL | Credentials |
|---|---|---|
| PostgreSQL | `localhost:5432` | `signage / signage` |
| MinIO API | `http://localhost:9000` | `minioadmin / minioadmin` |
| MinIO Console | `http://localhost:9001` | `minioadmin / minioadmin` |
| EMQX Dashboard | `http://localhost:18083` | `admin / public` |
| MQTT (TCP) | `localhost:1883` | — |
| MQTT (WS) | `localhost:8083` | — |
