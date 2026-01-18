/**
 * Authentication Routes
 * 
 * Handles user registration, login, and token refresh.
 * For MVP, uses simple email/password. Can integrate with Supabase Auth later.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { generateToken, requireAuth } = require('../middleware/auth');
const db = require('../db/connection');

/**
 * POST /api/auth/register
 * 
 * Register a new user and organization
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, organizationName } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = hashPassword(password);

    // Create organization first
    const orgResult = await db.query(
      `INSERT INTO organizations (name) VALUES ($1) RETURNING id`,
      [organizationName || `${name}'s Organization`]
    );
    const organizationId = orgResult.rows[0].id;

    // Create user
    const userResult = await db.query(
      `INSERT INTO users (email, password_hash, name, organization_id, role) 
       VALUES ($1, $2, $3, $4, 'admin') 
       RETURNING id, email, name, organization_id, role`,
      [email.toLowerCase(), passwordHash, name, organizationId]
    );

    const user = userResult.rows[0];

    // Create default settings for the organization
    await db.query(
      `INSERT INTO pricing_settings (organization_id, settings) VALUES ($1, $2)`,
      [organizationId, JSON.stringify(getDefaultSettings())]
    );

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * 
 * Authenticate user and return JWT token
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const result = await db.query(
      `SELECT id, email, password_hash, name, organization_id, role 
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Verify password
    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /api/auth/me
 * 
 * Get current user info from token
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.email, u.name, u.role, o.name as organization_name
       FROM users u
       JOIN organizations o ON u.organization_id = o.id
       WHERE u.id = $1`,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * POST /api/auth/refresh
 * 
 * Refresh JWT token
 */
router.post('/refresh', requireAuth, (req, res) => {
  try {
    const token = generateToken({
      id: req.user.userId,
      email: req.user.email,
      organization_id: req.user.organizationId,
      role: req.user.role
    });

    res.json({ token });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Helper functions
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

function getDefaultSettings() {
  return {
    baseFreightRate: 125,
    perMileRate: 0.85,
    palletBreakSurcharge: 15,
    minFreight: 75,
    marginFoodBank: 20,
    marginSchool: 15,
    marginCorporate: 25,
    volumeTiers: [
      { minCases: 0, maxCases: 50, discount: 0 },
      { minCases: 51, maxCases: 150, discount: 8 },
      { minCases: 151, maxCases: 300, discount: 15 },
      { minCases: 301, maxCases: 9999, discount: 22 }
    ],
    regions: [
      { id: 'east-bay', name: 'East Bay', distance: 25 },
      { id: 'sf', name: 'San Francisco', distance: 40 },
      { id: 'south-bay', name: 'South Bay', distance: 55 },
      { id: 'central-coast', name: 'Central Coast', distance: 120 },
      { id: 'sacramento', name: 'Sacramento', distance: 85 }
    ]
  };
}

module.exports = router;
