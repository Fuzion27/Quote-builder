require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const Anthropic = require('@anthropic-ai/sdk');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
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
    try {
      req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    } catch (e) {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

function generateToken(user) {
  return jwt.sign({
    userId: user.id,
    email: user.email,
    organizationId: user.organization_id,
    role: user.role
  }, JWT_SECRET, { expiresIn: '7d' });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, storedHash) {
  const parts = storedHash.split(':');
  const salt = parts[0];
  const hash = parts[1];
  const testHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === testHash;
}

app.get('/api/health', function(req, res) {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/api/auth/register', async function(req, res) {
  try {
    const email = req.body.email;
    const password = req.body.password;
    const name = req.body.name;
    const organizationName = req.body.organizationName;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name required' });
    }
    
    const orgResult = await db.query(
      'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
      [organizationName || name + ' Org']
    );
    const orgId = orgResult.rows[0].id;
    
    const hashedPw = hashPassword(password);
    const userResult = await db.query(
      'INSERT INTO users (email, password_hash, name, organization_id, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, organization_id, role',
      [email.toLowerCase(), hashedPw, name, orgId, 'admin']
    );
    const user = userResult.rows[0];
    const token = generateToken(user);
    
    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name },
      token: token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async function(req, res) {
  try {
    const email = req.body.email;
    const password = req.body.password;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const result = await db.query(
      'SELECT id, email, password_hash, name, organization_id, role FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = generateToken(user);
    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token: token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/ai/chat', optionalAuth, async function(req, res) {
  try {
    const message = req.body.message;
    const context = req.body.context;
    
    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }
    
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI not configured' });
    }
    
    var systemPrompt = 'You are a pricing assistant for Saba Grocers Initiative, a food hub in Oakland. Be concise.';
    if (context) {
      systemPrompt = systemPrompt + '\n\nContext: ' + JSON.stringify(context);
    }
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }]
    });
    
    var responseText = '';
    for (var i = 0; i < response.content.length; i++) {
      if (response.content[i].type === 'text') {
        responseText = responseText + response.content[i].text;
      }
    }
    
    res.json({ response: responseText });
  } catch (error) {
    console.error('AI error:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

app.get('/api/customers', requireAuth, async function(req, res) {
  try {
    const result = await db.query(
      'SELECT * FROM customers WHERE organization_id = $1 ORDER BY name',
      [req.user.organizationId]
    );
    res.json({ customers: result.rows });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ error: 'Failed to get customers' });
  }
});

app.post('/api/customers', requireAuth, async function(req, res) {
  try {
    const name = req.body.name;
    const type = req.body.type;
    const regionId = req.body.regionId;
    const contactEmail = req.body.contactEmail;
    
    if (!name) {
      return res.status(400).json({ error: 'Name required' });
    }
    
    const result = await db.query(
      'INSERT INTO customers (id, organization_id, name, type, region_id, contact_email) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [uuidv4(), req.user.organizationId, name, type, regionId, contactEmail]
    );
    res.status(201).json({ customer: result.rows[0] });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

app.get('/api/products', requireAuth, async function(req, res) {
  try {
    const result = await db.query(
      'SELECT * FROM products WHERE organization_id = $1 AND available = true ORDER BY name',
      [req.user.organizationId]
    );
    res.json({ products: result.rows });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to get products' });
  }
});

app.post('/api/products', requireAuth, async function(req, res) {
  try {
    const name = req.body.name;
    const costPerCase = req.body.costPerCase;
    
    if (!name || !costPerCase) {
      return res.status(400).json({ error: 'Name and cost required' });
    }
    
    const result = await db.query(
      'INSERT INTO products (id, organization_id, name, unit_type, cases_per_pallet, cost_per_case, weight, farm, location, category, bipoc, gap_certified, available) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true) RETURNING *',
      [
        uuidv4(),
        req.user.organizationId,
        name,
        req.body.unitType,
        req.body.casesPerPallet,
        costPerCase,
        req.body.weight,
        req.body.farm,
        req.body.location,
        req.body.category,
        req.body.bipoc || false,
        req.body.gapCertified || false
      ]
    );
    res.status(201).json({ product: result.rows[0] });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

app.get('/api/settings', requireAuth, async function(req, res) {
  try {
    const result = await db.query(
      'SELECT settings FROM pricing_settings WHERE organization_id = $1',
      [req.user.organizationId]
    );
    
    var settings = {
      baseFreightRate: 125,
      perMileRate: 0.85,
      palletBreakSurcharge: 15,
      minFreight: 75,
      marginFoodBank: 20,
      marginSchool: 15,
      marginCorporate: 25
    };
    
    if (result.rows.length > 0) {
      settings = result.rows[0].settings;
    }
    
    res.json({ settings: settings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

app.put('/api/settings', requireAuth, async function(req, res) {
  try {
    const settings = req.body.settings;
    await db.query(
      'INSERT INTO pricing_settings (organization_id, settings) VALUES ($1, $2) ON CONFLICT (organization_id) DO UPDATE SET settings = $2',
      [req.user.organizationId, JSON.stringify(settings)]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Save settings error:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

app.use(function(req, res) {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);
});
