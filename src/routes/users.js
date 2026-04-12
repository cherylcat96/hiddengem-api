const express = require('express');
const pool = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /users/me/saves  ← must be FIRST before /:username
router.get('/me/saves', authenticateToken, async (req, res) => {
  const { userID } = req.user;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(`
      SELECT
        g."gemID", g.name, g.description, g.category,
        g.location_label, g.created_at, s.saved_at,
        u.username, u.display_name,
        COUNT(DISTINCT s2."gemID") AS save_count,
        (SELECT url FROM photo p WHERE p."gemID" = g."gemID" AND p.display_order = 0 LIMIT 1) AS cover_photo,
        ARRAY(SELECT t.name FROM tag t WHERE t."gemID" = g."gemID") AS tags
      FROM save s
      JOIN gem g ON s."gemID" = g."gemID"
      JOIN "user" u ON g."userID" = u."userID"
      LEFT JOIN save s2 ON s2."gemID" = g."gemID"
      WHERE s."userID" = $1 AND g.is_flagged = FALSE
      GROUP BY g."gemID", u.username, u.display_name, s.saved_at
      ORDER BY s.saved_at DESC
      LIMIT $2 OFFSET $3
    `, [userID, limit, offset]);

    res.json({ gems: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong.' } });
  }
});

// PATCH /users/me  ← also before /:username
router.patch('/me', authenticateToken, async (req, res) => {
  const { userID } = req.user;
  const { display_name, bio, avatar_url } = req.body;

  try {
    const result = await pool.query(`
      UPDATE "user"
      SET
        display_name = COALESCE($1, display_name),
        bio          = COALESCE($2, bio),
        avatar_url   = COALESCE($3, avatar_url)
      WHERE "userID" = $4
      RETURNING "userID", username, display_name, bio, avatar_url
    `, [display_name, bio, avatar_url, userID]);

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong.' } });
  }
});

// GET /users/:username
router.get('/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const result = await pool.query(
      `SELECT "userID", username, display_name, bio, avatar_url, created_at
       FROM "user" WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'User not found.' }
      });
    }

    const user = result.rows[0];

    const gemCount = await pool.query(
      `SELECT COUNT(*) FROM gem WHERE "userID" = $1 AND is_flagged = FALSE`,
      [user.userID]
    );

    res.json({
      ...user,
      gem_count: Number(gemCount.rows[0].count),
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong.' } });
  }
});

// GET /users/:username/gems
router.get('/:username/gems', async (req, res) => {
  const { username } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const user = await pool.query(
      `SELECT "userID" FROM "user" WHERE username = $1`, [username]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
    }

    const userID = user.rows[0].userID;

    const result = await pool.query(`
      SELECT
        g."gemID", g.name, g.description, g.category,
        g.latitude, g.longitude, g.location_label, g.created_at,
        COUNT(DISTINCT s."gemID") AS save_count,
        (SELECT url FROM photo p WHERE p."gemID" = g."gemID" AND p.display_order = 0 LIMIT 1) AS cover_photo,
        ARRAY(SELECT t.name FROM tag t WHERE t."gemID" = g."gemID") AS tags
      FROM gem g
      LEFT JOIN save s ON s."gemID" = g."gemID"
      WHERE g."userID" = $1 AND g.is_flagged = FALSE
      GROUP BY g."gemID"
      ORDER BY g.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userID, limit, offset]);

    res.json({ gems: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong.' } });
  }
});

module.exports = router;