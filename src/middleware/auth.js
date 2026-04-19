const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db/pool');
const { sendVerificationEmail } = require('../services/emailService');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { display_name, username, email, password } = req.body;

  if (!display_name || !username || !email || !password) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'All fields are required.',
        fields: {
          ...(!display_name && { display_name: 'Display name is required.' }),
          ...(!username     && { username:      'Username is required.' }),
          ...(!email        && { email:         'Email is required.' }),
          ...(!password     && { password:      'Password is required.' }),
        }
      }
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Password too short.',
        fields: { password: 'Must be at least 8 characters.' }
      }
    });
  }

  try {
    const existing = await pool.query(
      `SELECT email, username FROM "user" WHERE email = $1 OR username = $2`,
      [email, username]
    );

    if (existing.rows.length > 0) {
      const taken = existing.rows[0];
      const field = taken.email === email ? 'email' : 'username';
      return res.status(409).json({
        error: { code: 'CONFLICT', message: `That ${field} is already registered.` }
      });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const verification_token = crypto.randomBytes(32).toString('hex');
    const verification_token_expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await pool.query(
      `INSERT INTO "user" (display_name, username, email, password_hash, verification_token, verification_token_expires)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING "userID", username, display_name, is_verified`,
      [display_name, username, email, password_hash, verification_token, verification_token_expires]
    );

    const user = result.rows[0];

    try {
      await sendVerificationEmail(email, verification_token);
    } catch (emailErr) {
      console.error('Failed to send verification email:', emailErr);
    }

    const token = jwt.sign(
      { userID: user.userID, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Something went wrong.' }
    });
  }
});

router.get('/verify-email', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Token is required.' }
    });
  }

  try {
    const result = await pool.query(
      `SELECT "userID" FROM "user"
       WHERE verification_token = $1
       AND verification_token_expires > NOW()
       AND is_verified = false`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: { code: 'INVALID_TOKEN', message: 'Token is invalid or has expired.' }
      });
    }

    await pool.query(
      `UPDATE "user"
       SET is_verified = true, verification_token = NULL, verification_token_expires = NULL
       WHERE "userID" = $1`,
      [result.rows[0].userID]
    );

    res.json({ message: 'Email verified successfully.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Something went wrong.' }
    });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Email and password are required.' }
    });
  }

  try {
    const result = await pool.query(
      `SELECT "userID", username, display_name, password_hash, is_verified, avatar_url
       FROM "user" WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' }
      });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' }
      });
    }

    const token = jwt.sign(
      { userID: user.userID, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password_hash, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Something went wrong.' }
    });
  }
});

module.exports = router;