# Environment setup

## Backend (`backend/.env`)
Copy `backend/.env.example` to `backend/.env` and keep these values aligned with your local services.

- `PORT=5000`: backend API port.
- `NODE_ENV=development`: development mode for local work.
- `TRUST_PROXY=1`: safe default behind a reverse proxy.
- `API_RATE_LIMIT=500`: API request cap per 15 minutes.
- `MONGO_URI=mongodb://127.0.0.1:27017/campusconnect`: local MongoDB connection string.
- `JWT_SECRET` and `JWT_REFRESH_SECRET`: long random secrets for access and refresh tokens.
- `JWT_EXPIRES_IN=15m`: access token lifetime.
- `JWT_REFRESH_EXPIRES_IN=7d`: refresh token lifetime.
- `FRONTEND_URL=http://localhost:3000`: React dev server origin for CORS.
- SMTP values can stay empty while local demo email features are disabled.
- `DISABLE_EMAILS=true`: keeps demo registration flows from failing when no SMTP account is configured.

## Frontend (`frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env`.

- `REACT_APP_API_URL=http://localhost:5000`: points Axios requests to the backend host.
- `REACT_APP_SOCKET_URL=http://localhost:5000`: points Socket.IO to the backend host so it does not try port 3000.
- `REACT_APP_APP_NAME=CampusConnect`: UI label.
- `REACT_APP_ENABLE_DEMO=true`: lets the app show demo fallbacks when the backend is offline.

## Important port split
- React runs on `http://localhost:3000`
- Backend runs on `http://localhost:5000`
- Socket.IO must connect to `http://localhost:5000`, not `3000`

## Recommended local run order
1. Start MongoDB.
2. Start the backend on port `5000`.
3. Start the React frontend on port `3000`.
4. Open the frontend in your browser.
