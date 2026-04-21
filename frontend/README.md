# CampusConnect Frontend

This React app runs on port 3000 and connects to the backend on port 5000.
Copy `frontend/.env.example` to `frontend/.env` and keep `REACT_APP_API_URL=http://localhost:5000` for local development.

## Development
1. Create `frontend/.env`
2. Run `npm install`
3. Run `npm start`

## Main pages
- `/home` — landing page
- `/events` — explorer with filters and pagination
- `/events/:id` — event detail view
