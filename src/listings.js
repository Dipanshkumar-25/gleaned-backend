const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const { requireAuth } = require('./auth');

const router = express.Router();

function toPublicListing(row) {
  return {
    id: row.id,
    donorUsername: row.donor_username,
    donorName: row.donor_name,
    donorOrg: row.donor_org,
    foodType: row.food_type,
    quantity: row.quantity,
    expiryTime: row.expiry_time,
    pickupWindow: row.pickup_window,
    location: row.location,
    notes: row.notes,
    status: row.status,
    claimedByUsername: row.claimed_by_username,
    claimedByName: row.claimed_by_name,
    createdAt: row.created_at
  };
}

// Public — used on the landing page, no auth required.
router.get('/stats', (req, res) => {
  const available = db.prepare("SELECT COUNT(*) AS c FROM listings WHERE status = 'available'").get().c;
  const completed = db.prepare("SELECT COUNT(*) AS c FROM listings WHERE status = 'completed'").get().c;
  const donorOrgs = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'donor'").get().c;
  res.json({ available, completed, donorOrgs });
});

router.use(requireAuth);

// GET /api/listings?scope=available|mine|claims
router.get('/', (req, res) => {
  const scope = req.query.scope || 'available';
  const u = req.user;
  let rows;

  if (scope === 'mine') {
    rows = db.prepare('SELECT * FROM listings WHERE donor_username = ? ORDER BY expiry_time ASC').all(u.username);
  } else if (scope === 'claims') {
    rows = db.prepare('SELECT * FROM listings WHERE claimed_by_username = ? ORDER BY expiry_time ASC').all(u.username);
  } else {
    rows = db.prepare("SELECT * FROM listings WHERE status = 'available' ORDER BY expiry_time ASC").all();
  }

  res.json({ listings: rows.map(toPublicListing) });
});

router.post('/', (req, res) => {
  const u = req.user;
  if (u.role !== 'donor') {
    return res.status(403).json({ error: 'Only donors can post listings.' });
  }

  const { foodType, quantity, expiryTime, pickupWindow, location, notes } = req.body || {};
  if (!foodType || !quantity || !expiryTime || !location) {
    return res.status(400).json({ error: 'Please fill in food type, quantity, pickup-by time, and location.' });
  }

  const id = 'id_' + crypto.randomBytes(9).toString('hex');
  db.prepare(`
    INSERT INTO listings
      (id, donor_username, donor_name, donor_org, food_type, quantity, expiry_time, pickup_window, location, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')
  `).run(
    id, u.username, u.name, u.org,
    String(foodType).trim(), String(quantity).trim(), expiryTime,
    String(pickupWindow || '').trim(), String(location).trim(), String(notes || '').trim()
  );

  const row = db.prepare('SELECT * FROM listings WHERE id = ?').get(id);
  res.status(201).json({ listing: toPublicListing(row) });
});

router.post('/:id/claim', (req, res) => {
  const u = req.user;
  if (u.role !== 'collector') {
    return res.status(403).json({ error: 'Only collectors can claim pickups.' });
  }

  const row = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Listing not found.' });
  if (row.status !== 'available') return res.status(409).json({ error: 'That listing is no longer available.' });

  db.prepare(`
    UPDATE listings SET status = 'claimed', claimed_by_username = ?, claimed_by_name = ? WHERE id = ?
  `).run(u.username, `${u.name} (${u.org})`, req.params.id);

  const updated = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  res.json({ listing: toPublicListing(updated) });
});

router.post('/:id/complete', (req, res) => {
  const u = req.user;
  const row = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Listing not found.' });
  if (row.claimed_by_username !== u.username) {
    return res.status(403).json({ error: 'Only the collector who claimed this can mark it picked up.' });
  }

  db.prepare("UPDATE listings SET status = 'completed' WHERE id = ?").run(req.params.id);
  const updated = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  res.json({ listing: toPublicListing(updated) });
});

router.delete('/:id', (req, res) => {
  const u = req.user;
  const row = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Listing not found.' });
  if (row.donor_username !== u.username) {
    return res.status(403).json({ error: 'Only the donor who posted this can cancel it.' });
  }

  db.prepare('DELETE FROM listings WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
