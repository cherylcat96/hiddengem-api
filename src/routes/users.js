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
  const authHeader = req.headers['authorization'];
  let viewerID = null;

  // Optionally decode token if present (don't require it)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
      viewerID = decoded.userID;
    } catch (_) {}
  }

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

    const [gemCount, followerCount, followingCount] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM gem WHERE "userID" = $1 AND is_flagged = FALSE`, [user.userID]),
      pool.query(`SELECT COUNT(*) FROM follow WHERE "followingID" = $1`, [user.userID]),
      pool.query(`SELECT COUNT(*) FROM follow WHERE "followerID" = $1`, [user.userID]),
    ]);

    let is_following = false;
    if (viewerID && viewerID !== user.userID) {
      const followCheck = await pool.query(
        `SELECT 1 FROM follow WHERE "followerID" = $1 AND "followingID" = $2`,
        [viewerID, user.userID]
      );
      is_following = followCheck.rows.length > 0;
    }

    res.json({
      ...user,
      gem_count: Number(gemCount.rows[0].count),
      follower_count: Number(followerCount.rows[0].count),
      following_count: Number(followingCount.rows[0].count),
      is_following,
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

// POST /users/:username/follow
router.post('/:username/follow', authenticateToken, async (req, res) => {
  const { userID: followerID } = req.user;
  const { username } = req.params;

  try {
    const target = await pool.query(
      `SELECT "userID" FROM "user" WHERE username = $1`, [username]
    );

    if (target.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
    }

    const followingID = target.rows[0].userID;

    if (followerID === followingID) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'You cannot follow yourself.' } });
    }

    await pool.query(
      `INSERT INTO follow ("followerID", "followingID") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [followerID, followingID]
    );

    res.status(201).json({ message: 'Followed successfully.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong.' } });
  }
});

// DELETE /users/:username/follow
router.delete('/:username/follow', authenticateToken, async (req, res) => {
  const { userID: followerID } = req.user;
  const { username } = req.params;

  try {
    const target = await pool.query(
      `SELECT "userID" FROM "user" WHERE username = $1`, [username]
    );

    if (target.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
    }

    const followingID = target.rows[0].userID;

    await pool.query(
      `DELETE FROM follow WHERE "followerID" = $1 AND "followingID" = $2`,
      [followerID, followingID]
    );

    res.json({ message: 'Unfollowed successfully.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong.' } });
  }
});

// GET /users/:username/followers
router.get('/:username/followers', async (req, res) => {
  const { username } = req.params;

  try {
    const target = await pool.query(
      `SELECT "userID" FROM "user" WHERE username = $1`, [username]
    );

    if (target.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
    }

    const result = await pool.query(`
      SELECT u."userID", u.username, u.display_name, u.avatar_url
      FROM follow f
      JOIN "user" u ON u."userID" = f."followerID"
      WHERE f."followingID" = $1
      ORDER BY f.created_at DESC
    `, [target.rows[0].userID]);

    res.json({ users: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong.' } });
  }
});

// GET /users/:username/following
router.get('/:username/following', async (req, res) => {
  const { username } = req.params;

  try {
    const target = await pool.query(
      `SELECT "userID" FROM "user" WHERE username = $1`, [username]
    );

    if (target.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
    }

    const result = await pool.query(`
      SELECT u."userID", u.username, u.display_name, u.avatar_url
      FROM follow f
      JOIN "user" u ON u."userID" = f."followingID"
      WHERE f."followerID" = $1
      ORDER BY f.created_at DESC
    `, [target.rows[0].userID]);

    res.json({ users: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong.' } });
  }
});

module.exports = router;