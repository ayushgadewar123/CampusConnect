# CampusConnect

A student-friendly MERN project for campus event management.

## Core features

- Student and admin login
- Browse events and view event details
- Register for events
- Saved events and announcements
- Admin event CRUD
- Role-based access control

## Run locally

Backend:
```bash
cd backend
cp .env.example .env
npm install
npm start
```

Frontend:
```bash
cd frontend
cp .env.example .env
npm install
npm start
```

## Main routes

- `/home` — dashboard
- `/events` — event explorer
- `/events/:id` — event details
- `/wishlist` — saved events
- `/announcements` — notices and updates

## Docker

```bash
docker compose up --build
```

## Notes

The project focuses on the essential college workflow: login, browse, register, and manage events.
