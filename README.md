# Gleaned backend

Express + SQLite (better-sqlite3) backend for the Gleaned food-waste matchmaker
app, replacing the original browser-storage prototype (`gleaned.html`) with
real accounts and a shared listings database.

## Setup

```bash
npm install
cp .env.example .env      # then edit JWT_SECRET to a long random string
npm start                 # or: npm run dev (auto-restart on change)
```

The server serves the frontend itself, so once it's running just open:

```
http://localhost:3001
```

`public/gleaned.html` (same file as `public/index.html`) now calls the API
with `fetch(..., { credentials: 'include' })` instead of `window.storage`,
and auth is a signed, httpOnly JWT cookie rather than anything stored client-side.

## Layout

```
src/db.js        SQLite connection + schema (users, listings)
src/auth.js      /api/auth: signup, login, logout, me  (bcrypt + JWT cookie)
src/listings.js  /api/listings: browse/post/claim/complete/cancel + public stats
src/server.js    Express app: middleware, routers, static file serving
public/          gleaned.html served as the frontend
```

## API summary

| Method | Path                        | Auth | Notes |
|---|---|---|---|
| POST | /api/auth/signup            | –    | body: name, org, username, password, role |
| POST | /api/auth/login             | –    | body: username, password |
| POST | /api/auth/logout            | –    | clears the cookie |
| GET  | /api/auth/me                | ✓    | current user |
| GET  | /api/listings/stats         | –    | landing-page counts |
| GET  | /api/listings?scope=…       | ✓    | scope: available \| mine \| claims |
| POST | /api/listings                | ✓ donor | create a listing |
| POST | /api/listings/:id/claim      | ✓ collector | |
| POST | /api/listings/:id/complete   | ✓ claiming collector | |
| DELETE | /api/listings/:id          | ✓ owning donor | |

## Notes / things to harden before real use

- `FRONTEND_ORIGIN` in `.env` only matters if you serve the HTML from a
  different origin than the API — same-origin (the default here) doesn't need CORS at all.
- Rate-limit `/api/auth/login` and `/api/auth/signup` before deploying publicly.
- SQLite file (`gleaned.db`) is created next to wherever you run `npm start` —
  set `DB_PATH` in `.env` to control that.
