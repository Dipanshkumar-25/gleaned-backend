const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'gleaned_token';
const TOKEN_TTL = '7d';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Copy .env.example to .env and set a real secret.');
}

function signToken(user) {
  return jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE_MS
  });
}

function toPublicUser(row) {
  return { username: row.username, name: row.name, org: row.org, role: row.role };
}

function requireAuth(req, res, next) {
  const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
  if (!token) return res.status(401).json({ error: 'Not signed in.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(payload.username);
    if (!user) return res.status(401).json({ error: 'Not signed in.' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expired, please log in again.' });
  }
}

router.post('/signup', (req, res) => {
  const { name, org, username, password, role } = req.body || {};

  if (!name || !org || !username || !password || !role) {
    return res.status(400).json({ error: 'Please fill in every field.' });
  }
  if (!['donor', 'collector'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const uname = String(username).trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(uname);
  if (existing) {
    return res.status(409).json({ error: 'That username is taken — try another.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare(
    'INSERT INTO users (username, name, org, role, password_hash) VALUES (?, ?, ?, ?, ?)'
  ).run(uname, String(name).trim(), String(org).trim(), role, passwordHash);

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(uname);
  const token = signToken(user);
  setAuthCookie(res, token);
  res.status(201).json({ user: toPublicUser(user) });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Please enter a username and password.' });
  }

  const uname = String(username).trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(uname);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }

  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ user: toPublicUser(user) });
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

module.exports = { router, requireAuth, toPublicUser, COOKIE_NAME };
