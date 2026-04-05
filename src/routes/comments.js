const express = require('express');
const pool = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// GET /gems/:id/comments
router.get('/', async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(`
      SELECT
        c."commentID", c.body, c.created_at,
        u.display_name, u.username, u.avatar_url,
        (c."userID" = g."userID") AS is_author
      FROM comment c
      JOIN "user" u ON c."userID" = u."userID"
      JOIN gem g    ON c."gemID"  = g."gemID"
      WHERE c."gemID" = $1
      ORDER BY c.created_at ASC
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);

    const count = await pool.query(
      `SELECT COUNT(*) FROM comment WHERE "gemID" = $1`, [id]
    );

    res.json({
      comments: result.rows,
      pagination: { page: Number(page), limit: Number(limit), total: Number(count.rows[0].count) }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong.' } });
  }
});

// POST /gems/:id/comments
router.post('/', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { body } = req.body;
  const { userID } = req.user;

  if (!body || !body.trim()) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Comment cannot be empty.' }
    });
  }

  try {
    const result = await pool.query(`
      INSERT INTO comment ("gemID", "userID", body)
      VALUES ($1, $2, $3)
      RETURNING "commentID", body, created_at
    `, [id, userID, body.trim()]);

    const comment = result.rows[0];

    const user = await pool.query(
      `SELECT display_name, username, avatar_url FROM "user" WHERE "userID" = $1`,
      [userID]
    );

    const gem = await pool.query(
      `SELECT "userID" FROM gem WHERE "gemID" = $1`, [id]
    );

    res.status(201).json({
      ...comment,
      ...user.rows[0],
      is_author: gem.rows[0]?.userID === userID,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong.' } });
  }
});

module.exports = router;