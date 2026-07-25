# Golang Todo App

Aplikasi todo full-stack dengan **Golang + GraphQL + MySQL + GORM** (backend) dan **Vite + React** (frontend).

## Fitur

- Login via tabel `masteruser` (kolom `kodeku`, `usernameku`, `password`)
- Tidak ada register / lupa password
- CRUD task dengan status (pending, in_progress, completed)
- Komentar dan meta data per task
- JWT authentication

## Struktur

```
golang-todo/
├── backend/          # Go API + GraphQL
├── frontend/         # React + Vite
└── scripts/          # SQL init tables
```

## Setup Database

Pastikan MySQL sudah berjalan. Tabel `masteruser` sudah ada di database.

Buat tabel task (atau biarkan GORM AutoMigrate saat backend start):

```bash
mysql -h 127.0.0.1 -P 6033 -u laravel_user -p dory8752_from_local < scripts/init_tables.sql
```

## Konfigurasi Backend

Copy `.env` di folder `backend/` (sudah disediakan):

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=6033
DB_DATABASE=dory8752_from_local
DB_USERNAME=laravel_user
DB_PASSWORD=123456
JWT_SECRET=change-me-in-production
SERVER_PORT=8080
```

## Menjalankan

Dari root project:

```bash
npm install   # sekali saja
npm run dev   # backend + frontend sekaligus
```

- Frontend: http://localhost:5173
- GraphQL: http://localhost:8080/query (GraphiQL enabled)

## Build

```bash
npm run build
```

Output:
- `backend/bin/server` — binary Go
- `frontend/dist/` — static frontend

## Menjalankan (manual, opsional)

**Backend saja:**

```bash
cd backend
go run .
```

**Frontend saja:**

```bash
cd frontend
npm run dev
```

## GraphQL API

| Operation | Deskripsi |
|-----------|-----------|
| `login(username, password)` | Login, return JWT token |
| `tasks` | List task user yang login |
| `createTask(input)` | Buat task baru |
| `updateTask(id, input)` | Update task |
| `deleteTask(id)` | Hapus task |
| `addTaskComment(taskId, content)` | Tambah komentar |
| `setTaskMeta(taskId, key, value)` | Set meta task |
