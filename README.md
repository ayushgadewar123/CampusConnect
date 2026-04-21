# CampusConnect

Production-ready MERN event management platform for colleges and campuses.

## Run locally

Backend (port 5000):
```bash
cd backend
cp .env.example .env
npm install
npm start
```

Frontend (port 3000):
```bash
cd frontend
cp .env.example .env
npm install
npm start
```

## Main routes

- `/home` — polished landing page
- `/events` — event explorer with filters and pagination
- `/events/:id` — event details
- `/wishlist` — saved events
- `/announcements` — notices and updates

## Docker

```bash
docker compose up --build
```

## Production highlights

- Socket.IO real-time updates
- Email notifications and verification flows
- JWT + refresh token auth
- Role-based access control
- Uploads, analytics, exports, and certificates
- System status page for deployment support

## Automated reminder jobs

The backend runs periodic maintenance sweeps to sync event lifecycle status, send upcoming event reminders, and clean old notifications. You can also trigger a sweep manually from the System page in the admin UI.


### Email safety
Local email sending is disabled by default in the example env file. Enable it only after you configure a real SMTP account and an inbox you own.

See `ENVIRONMENT.md` for the exact meaning of every `.env` key, including the separate Socket.IO URL.
