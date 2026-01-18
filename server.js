require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const Anthropic = require('@anthropic-ai/sdk');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const db = { query: (text, params) => pool.query(text, params) };

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try { req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET); } catch (e) { req.user = null; }
  } else { req.user = null; }
  next();
}

function generateToken(user) {
  return jwt.sign({ userId: user.id, email: user.email, organizationId: user.organization_id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function hashPassword(password) {
  const crypto = require('crypto');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, storedHash) {
  const crypto = require('crypto');
  const [salt, hash] = storedHash.split(':');
  return hash === crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, organizationName } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, password, and name required' });
    const orgResult = await db.query('INSERT INTO organizations (name) VALUES ($1) RETURNING id', [organizationName || name + ' Org']);
    const orgId = orgResult.rows[0].id;
    const userResult = await db.query('INSERT INTO users (email, password_hash, name, organization_id, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, organization_id, role',
      [email.toLowerCase(), hashPassword(password), name, orgId, 'admin']);
    const user = userResult.rows[0];
    res.status(201).json({ user: { id: user.id, email: user.email, name: user.name }, token: generateToken(user) });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const result = await db.query('SELECT id, email, password_hash, name, organization_id, role FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0 || !verifyPassword(password, result.rows[0].password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    res.json({ user: { id: user.id, email: user.email, name: user.name }, token: generateToken(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/ai/chat', optionalAuth, async (req, res) => {
  try {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI not configured' });
    let systemPrompt = 'You are a pricing assistant for Saba Grocers Initiative, a food hub in Oakland. Be concise.';
    if (context) systemPrompt += '\n\nContext: ' + JSON.stringify(context);
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }]
    });
    res.json({ response: response.content.filter(b => b.type === 'text').map(b => b.text).join('\n') });
  } catch (error) {
    console.error('AI error:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

app.get('/api/customers', requireAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM customers WHERE organization_id = $1 ORDER BY name', [req.user.organizationId]);
    res.json({ customers: result.rows });
  } catch (error) {
