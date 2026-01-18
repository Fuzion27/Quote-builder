# Saba Quote Builder — Full Stack Architecture

## Project Overview

This is a complete quoting system with:
- **Frontend**: HTML/JS application for building quotes
- **Backend**: Node.js/Express API server that handles AI requests securely
- **Database**: PostgreSQL (via Supabase) for persisting quotes, customers, and products
- **Deployment**: Ready for Vercel (frontend) + Railway/Render (backend)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER'S BROWSER                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Quote Builder Frontend                           │    │
│  │  - Product catalog                                                   │    │
│  │  - Quote builder UI                                                  │    │
│  │  - Logistics calculator                                              │    │
│  │  - PDF/CSV export                                                    │    │
│  └──────────────────────────────┬──────────────────────────────────────┘    │
└─────────────────────────────────┼───────────────────────────────────────────┘
                                  │ HTTPS
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND API SERVER                                 │
│                         (Node.js + Express)                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  /api/ai/chat        → Proxies requests to Claude API               │    │
│  │  /api/quotes         → CRUD operations for quotes                   │    │
│  │  /api/customers      → Customer management                          │    │
│  │  /api/products       → Product catalog management                   │    │
│  │  /api/settings       → Pricing settings per organization            │    │
│  └──────────────────────────────┬──────────────────────────────────────┘    │
│                                  │                                           │
│  Environment Variables:          │                                           │
│  - ANTHROPIC_API_KEY            │                                           │
│  - DATABASE_URL                  │                                           │
│  - JWT_SECRET                    │                                           │
└─────────────────────────────────┼───────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│      ANTHROPIC API            │ │      POSTGRESQL DATABASE      │
│   (Claude AI Services)        │ │        (via Supabase)         │
│                               │ │                               │
│  - Pricing analysis           │ │  Tables:                      │
│  - Quote optimization         │ │  - organizations              │
│  - Recommendations            │ │  - users                      │
│                               │ │  - customers                  │
│                               │ │  - products                   │
│                               │ │  - quotes                     │
│                               │ │  - quote_items                │
│                               │ │  - pricing_settings           │
└───────────────────────────────┘ └───────────────────────────────┘
```

---

## Project Structure

```
saba-quote-builder/
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── server.js                 # Main Express server
│   ├── routes/
│   │   ├── ai.js                 # Claude API proxy
│   │   ├── quotes.js             # Quote CRUD
│   │   ├── customers.js          # Customer management
│   │   ├── products.js           # Product catalog
│   │   └── settings.js           # Pricing settings
│   ├── middleware/
│   │   └── auth.js               # JWT authentication
│   ├── services/
│   │   ├── anthropic.js          # Claude API wrapper
│   │   └── logistics.js          # Freight calculations
│   └── db/
│       ├── schema.sql            # Database schema
│       └── seed.sql              # Sample data
│
├── frontend/
│   ├── index.html                # Main application
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── app.js                # Main application logic
│   │   ├── api.js                # Backend API client
│   │   ├── logistics.js          # Freight calculations
│   │   ├── quote.js              # Quote management
│   │   └── export.js             # PDF/CSV export
│   └── assets/
│
├── docker-compose.yml            # Local development
├── README.md
└── .gitignore
```

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- npm or yarn
- PostgreSQL (or use Supabase free tier)
- Anthropic API key

### 1. Clone and install

```bash
# Create project directory
mkdir saba-quote-builder
cd saba-quote-builder

# Copy the backend files (provided separately)
# Copy the frontend files (provided separately)

# Install backend dependencies
cd backend
npm install

# Create environment file
cp .env.example .env
# Edit .env with your values
```

### 2. Set up database

```bash
# Option A: Local PostgreSQL
createdb saba_quotes
psql saba_quotes < db/schema.sql
psql saba_quotes < db/seed.sql

# Option B: Supabase (recommended)
# 1. Create project at supabase.com
# 2. Run schema.sql in SQL editor
# 3. Copy connection string to .env
```

### 3. Configure environment

Edit `backend/.env`:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-xxxxx
DATABASE_URL=postgresql://user:pass@host:5432/saba_quotes
JWT_SECRET=your-random-secret-key

# Optional
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### 4. Run the application

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Serve frontend (simple option)
cd frontend
npx serve .

# Or just open index.html in browser for local testing
```

---

## Deployment Options

### Option A: Vercel + Railway (Recommended)

**Frontend (Vercel):**
```bash
cd frontend
vercel
```

**Backend (Railway):**
1. Connect GitHub repo to Railway
2. Set environment variables
3. Deploy

**Database (Supabase):**
- Free tier includes PostgreSQL
- Automatic backups
- Built-in auth (optional)

### Option B: Single Server (Render/Fly.io)

Deploy everything on one service:
```bash
# Render will auto-detect Node.js
# Set build command: cd backend && npm install
# Set start command: cd backend && npm start
```

### Option C: Docker

```bash
docker-compose up
```

---

## API Endpoints Reference

### Authentication
All endpoints except `/api/health` require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

### AI Assistant
```
POST /api/ai/chat
Body: { "message": "string", "context": { quote data } }
Returns: { "response": "AI response text" }
```

### Quotes
```
GET    /api/quotes              # List all quotes
GET    /api/quotes/:id          # Get single quote
POST   /api/quotes              # Create quote
PUT    /api/quotes/:id          # Update quote
DELETE /api/quotes/:id          # Delete quote
POST   /api/quotes/:id/finalize # Mark as sent/final
```

### Customers
```
GET    /api/customers           # List customers
POST   /api/customers           # Create customer
PUT    /api/customers/:id       # Update customer
DELETE /api/customers/:id       # Delete customer
```

### Products
```
GET    /api/products            # List products
POST   /api/products            # Create product
PUT    /api/products/:id        # Update product
DELETE /api/products/:id        # Delete product
POST   /api/products/import     # Bulk import from CSV
```

### Settings
```
GET    /api/settings            # Get pricing settings
PUT    /api/settings            # Update pricing settings
```

---

## Security Considerations

1. **API Key Protection**: Anthropic key never exposed to frontend
2. **Authentication**: JWT tokens with expiration
3. **CORS**: Restricted to your frontend domain
4. **Rate Limiting**: Prevents abuse of AI endpoint
5. **Input Validation**: All inputs sanitized
6. **HTTPS**: Required in production

---

## Future Enhancements

### Phase 2: Multi-tenancy
- Organization accounts
- User roles (admin, sales, viewer)
- Organization-specific settings

### Phase 3: Email Integration
- Send quotes directly via SendGrid/Resend
- Email parser for vendor pricelists
- Automated price updates

### Phase 4: Analytics
- Quote conversion tracking
- Margin analysis dashboard
- Customer lifetime value

### Phase 5: Integrations
- Odoo ERP sync
- QuickBooks integration
- Webhook notifications

---

## Support

For questions about this architecture or help with implementation:
- Review the code comments in each file
- Check the API documentation above
- Test endpoints with the included Postman collection

