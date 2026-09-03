require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

require('./db'); // creates tables on boot if they don't exist yet
const { router: authRouter } = require('./auth');
const listingsRouter = require('./listings');

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/listings', listingsRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Serves gleaned.html (and any other static assets) if placed in /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// 404 for unmatched /api routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`Gleaned backend listening on http://localhost:${PORT}`);
});
