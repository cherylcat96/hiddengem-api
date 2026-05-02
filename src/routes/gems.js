const express = require('express');
const pool = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /gems
router.get('/', async (req, res) => {
  const { category, tag, sort = 'newest', page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let conditions = [`g.is_flagged = FALSE`, `g.privacy = 'public'`];
    let params = [];
    let paramIndex = 1;

    if (category) {
      conditions.push(`g.category = $${paramIndex++}`);
      params.push(category);
    }

    if (tag) {
      conditions.push(`EXISTS (
        SELECT 1 FROM tag t WHERE t."gemID" = g."gemID" AND t.name = $${paramIndex++}
      )`);
      params.push(tag);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const orderMap = {
      newest:     'g.created_at DESC',
      most_saved: 'save_count DESC',
    };
    const orderBy = orderMap[sort] || 'g.created_at DESC';

    const query = `
      SELECT
        g."gemID", g.name, g.description, g.category,
        g.latitude, g.longitude, g.location_label,
        g.created_at,
        u.username, u.display_name, u.avatar_url,
        COUNT(DISTINCT s."gemID") AS save_count,
        (SELECT url FROM photo p WHERE p."gemID" = g."gemID" AND p.display_order = 0 LIMIT 1) AS cover_photo,
        ARRAY(SELECT t.name FROM tag t WHERE t."gemID" = g."gemID") AS tags
      FROM gem g
      JOIN "user" u ON g."userID" = u."userID"
      LEFT JOIN save s ON s."gemID" = g."gemID"
      ${whereClause}
      GROUP BY g."gemID", u.username, u.display_name, u.avatar_url
      ORDER BY ${orderBy}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);
    const result = await pool.query(query, params);

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM gem g ${whereClause}`,
      params.slice(0, params.length - 2)
    );

    res.json({
      gems: result.rows,
      pagination: {
        page:  Number(page),
        limit: Number(limit),
        total: Number(countResult.rows[0].count),
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Something went wrong.' }
    });
  }
});

// GET /gems/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT
        g."gemID", g.name, g.description, g.category,
        g.latitude, g.longitude, g.location_label,
        g.privacy, g.view_count, g.created_at,
        u.username, u.display_name, u.avatar_url,
        COUNT(DISTINCT s."gemID") AS save_count,
        ARRAY(SELECT t.name FROM tag t WHERE t."gemID" = g."gemID") AS tags
      FROM gem g
      JOIN "user" u ON g."userID" = u."userID"
      LEFT JOIN save s ON s."gemID" = g."gemID"
      WHERE g."gemID" = $1 AND g.is_flagged = FALSE
      GROUP BY g."gemID", u.username, u.display_name, u.avatar_url
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Gem not found.' }
      });
    }

    const gem = result.rows[0];

    // Get photos
    const photos = await pool.query(
      `SELECT url, display_order FROM photo WHERE "gemID" = $1 ORDER BY display_order`,
      [id]
    );

    // Increment view count
    await pool.query(
      `UPDATE gem SET view_count = view_count + 1 WHERE "gemID" = $1`,
      [id]
    );

    res.json({ ...gem, photos: photos.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Something went wrong.' }
    });
  }
});

// POST /gems
router.post('/', authenticateToken, async (req, res) => {
  const { name, description, category, latitude, longitude, location_label, privacy = 'public', tags = [], photos = [] } = req.body;
  const { userID } = req.user;

  if (!name || !description || !category || !latitude || !longitude) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Name, description, category, and location are required.',
      }
    });
  }

  const validCategories = ['Nature', 'Food', 'Art', 'Architecture', 'Historic', 'Other'];
  if (!validCategories.includes(category)) {
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid category.' }
    });
  }

  try {
    const gemResult = await pool.query(`
      INSERT INTO gem ("userID", name, description, category, latitude, longitude, location_label, privacy)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING "gemID", name, created_at
    `, [userID, name, description, category, latitude, longitude, location_label, privacy]);

    const gem = gemResult.rows[0];
    const gemID = gem.gemID;

    for (const tag of tags) {
      if (tag.trim()) {
        await pool.query(
          `INSERT INTO tag ("gemID", name) VALUES ($1, $2)`,
          [gemID, tag.trim().toLowerCase()]
        );
      }
    }

    for (let i = 0; i < photos.length; i++) {
      await pool.query(
        `INSERT INTO photo ("gemID", url, display_order) VALUES ($1, $2, $3)`,
        [gemID, photos[i].url, i]
      );
    }

    res.status(201).json(gem);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Something went wrong.' }
    });
  }
});

// DELETE /gems/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { userID } = req.user;

  try {
    const gem = await pool.query(
      `SELECT "userID" FROM gem WHERE "gemID" = $1`, [id]
    );

    if (gem.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Gem not found.' } });
    }

    if (gem.rows[0].userID !== userID) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not your gem.' } });
    }

    await pool.query(`DELETE FROM gem WHERE "gemID" = $1`, [id]);
    res.status(204).send();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong.' } });
  }
});

// PATCH /gems/:id
router.patch('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { userID } = req.user;
  const { name, description, category, location_label, privacy, tags, photos } = req.body;

  try {
    const existing = await pool.query(
      `SELECT "userID" FROM gem WHERE "gemID" = $1`, [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Gem not found.' } });
    }

    if (existing.rows[0].userID !== userID) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not your gem.' } });
    }

    const result = await pool.query(`
      UPDATE gem SET
        name           = COALESCE($1, name),
        description    = COALESCE($2, description),
        category       = COALESCE($3, category),
        location_label = COALESCE($4, location_label),
        privacy        = COALESCE($5, privacy)
      WHERE "gemID" = $6
      RETURNING "gemID", name, description, category, location_label, privacy
    `, [name, description, category, location_label, privacy, id]);

    // Replace tags if provided
    if (tags) {
      await pool.query(`DELETE FROM tag WHERE "gemID" = $1`, [id]);
      for (const tag of tags) {
        if (tag.trim()) {
          await pool.query(
            `INSERT INTO tag ("gemID", name) VALUES ($1, $2)`,
            [id, tag.trim().toLowerCase()]
          );
        }
      }
    }

    // Replace photos if provided
    if (photos) {
      await pool.query(`DELETE FROM photo WHERE "gemID" = $1`, [id]);
      for (let i = 0; i < photos.length; i++) {
        await pool.query(
          `INSERT INTO photo ("gemID", url, display_order) VALUES ($1, $2, $3)`,
          [id, photos[i].url, i]
        );
      }
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong.' } });
  }
});

module.exports = router;