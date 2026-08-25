import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { generateToken, verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check duplicate
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Insert user
    const insertRes = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [normalizedEmail, password_hash]
    );

    const user = insertRes.rows[0];
    const token = generateToken({ id: user.id, email: user.email });

    return res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: { id: user.id, email: user.email }
    });
  } catch (err) {
    console.error('Registration error:', err.message || err);
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: 'Database not connected. Please create a Postgres DB on Render and set DATABASE_URL.' });
    }
    return res.status(500).json({ error: `Registration error: ${err.message || 'Database error'}` });
  }
});

// Login existing user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const userRes = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [normalizedEmail]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = userRes.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken({ id: user.id, email: user.email });

    return res.json({
      message: 'Logged in successfully.',
      token,
      user: { id: user.id, email: user.email }
    });
  } catch (err) {
    console.error('Login error:', err.message || err);
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: 'Database not connected. Please set DATABASE_URL on Render.' });
    }
    return res.status(500).json({ error: `Login error: ${err.message || 'Database error'}` });
  }
});

// Get current user profile
router.get('/me', verifyToken, async (req, res) => {
  try {
    const userRes = await pool.query('SELECT id, email, created_at FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User account not found.' });
    }
    return res.json({ user: userRes.rows[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

export default router;
