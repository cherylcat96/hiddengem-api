const express = require('express');
const pool = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// POST /gems/:id/saves
router.post('/', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { userID } = req.user;

  try {
    await pool.query(
      `INSERT INTO save ("userID", "gemID") VALUES ($1, $2)`,
      [userID, id]
    );
    const count = await pool.query(
      `SELECT COUNT(*) FROM save WHERE "gemID" = $1`, [id]
    );
    res.status(201).json({ message: 'Gem saved.', save_count: Number(count.rows[0].count) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: { code: 'ALREADY_SAVED', message: 'Already saved.' } });
    }
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong.' } });
  }
});

// DELETE /gems/:id/saves
router.delete('/', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { userID } = req.user;

  try {
    await pool.query(
      `DELETE FROM save WHERE "userID" = $1 AND "gemID" = $2`,
      [userID, id]
    );
    const count = await pool.query(
      `SELECT COUNT(*) FROM save WHERE "gemID" = $1`, [id]
    );
    res.json({ message: 'Gem unsaved.', save_count: Number(count.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong.' } });
  }
});

module.exports = router;