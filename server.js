/**
 * Saba Quote Builder - Backend API Server
 * 
 * This server handles:
 * - Secure Claude AI API proxying
 * - Quote, customer, and product CRUD operations
 * - Pricing settings management
 * - Authentication via JWT
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import routes
const aiRoutes = require('./routes/ai');
const quotesRoutes = require('./routes/quotes');
const customersRoutes = require('./routes/customers');
const productsRoutes = require('./routes/products');
const settingsRoutes = require('./routes/settings');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// ===========================================
// MIDDLEWARE
// ===========================================

// Security headers
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : ['http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Rate limiting - general
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: 'Too many requests, please try again later.' }
});
app.use(generalLimiter);

// Rate limiting - AI endpoint (more restrictive)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 AI requests per minute
  message: { error: 'AI rate limit exceeded. Please wait a moment.' }
});

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
    next();
  });
}

// ===========================================
// ROUTES
// ===========================================

// Health check (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Authentication routes (no auth required)
app.use('/api/auth', authRoutes);

// AI routes (with stricter rate limiting)
app.use('/api/ai', aiLimiter, aiRoutes);

// Protected routes
app.use('/api/quotes', quotesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/settings', settingsRoutes);

// ===========================================
// ERROR HANDLING
// ===========================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(err.status || 500).json({ error: message });
});

// ===========================================
// START SERVER
// ===========================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║         Saba Quote Builder API Server                 ║
╠═══════════════════════════════════════════════════════╣
║  Status:    Running                                   ║
║  Port:      ${PORT}                                        ║
║  Mode:      ${process.env.NODE_ENV || 'development'}                              ║
║  AI:        ${process.env.ANTHROPIC_API_KEY ? 'Configured ✓' : 'NOT CONFIGURED ✗'}                         ║
║  Database:  ${process.env.DATABASE_URL ? 'Configured ✓' : 'NOT CONFIGURED ✗'}                         ║
╚═══════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
