require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const aiRoutes = require('./routes/ai');
const quotesRoutes = require('./routes/quotes');
const customersRoutes = require('./routes/customers');
const productsRoutes = require('./routes/products');
const settingsRoutes = require('./routes/settings');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use(generalLimiter);

// AI rate limiting
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'AI rate limit exceeded. Please wait a moment.' }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/settings', settingsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
