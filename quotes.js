/**
 * Quotes Routes
 * 
 * CRUD operations for quotes with line items.
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const db = require('../db/connection');

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/quotes
 * 
 * List all quotes for the user's organization
 */
router.get('/', async (req, res) => {
  try {
    const { status, customerId, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT q.*, c.name as customer_name, c.type as customer_type,
             COUNT(qi.id) as item_count,
             COALESCE(SUM(qi.line_total), 0) as total_value
      FROM quotes q
      LEFT JOIN customers c ON q.customer_id = c.id
      LEFT JOIN quote_items qi ON q.id = qi.quote_id
      WHERE q.organization_id = $1
    `;
    const params = [req.user.organizationId];
    let paramIndex = 2;

    if (status) {
      query += ` AND q.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (customerId) {
      query += ` AND q.customer_id = $${paramIndex}`;
      params.push(customerId);
      paramIndex++;
    }

    query += ` GROUP BY q.id, c.name, c.type ORDER BY q.updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({ quotes: result.rows });

  } catch (error) {
    console.error('List quotes error:', error);
    res.status(500).json({ error: 'Failed to list quotes' });
  }
});

/**
 * GET /api/quotes/:id
 * 
 * Get a single quote with all line items
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get quote
    const quoteResult = await db.query(
      `SELECT q.*, c.name as customer_name, c.type as customer_type, c.region_id
       FROM quotes q
       LEFT JOIN customers c ON q.customer_id = c.id
       WHERE q.id = $1 AND q.organization_id = $2`,
      [id, req.user.organizationId]
    );

    if (quoteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    const quote = quoteResult.rows[0];

    // Get line items
    const itemsResult = await db.query(
      `SELECT qi.*, p.name as product_name, p.unit_type, p.cases_per_pallet, 
              p.farm, p.location, p.bipoc, p.gap_certified
       FROM quote_items qi
       JOIN products p ON qi.product_id = p.id
       WHERE qi.quote_id = $1
       ORDER BY qi.created_at`,
      [id]
    );

    quote.items = itemsResult.rows;

    res.json({ quote });

  } catch (error) {
    console.error('Get quote error:', error);
    res.status(500).json({ error: 'Failed to get quote' });
  }
});

/**
 * POST /api/quotes
 * 
 * Create a new quote
 */
router.post('/', async (req, res) => {
  try {
    const { customerId, distance, notes, items = [] } = req.body;

    const quoteId = uuidv4();

    // Create quote
    const quoteResult = await db.query(
      `INSERT INTO quotes (id, organization_id, customer_id, distance, notes, status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6)
       RETURNING *`,
      [quoteId, req.user.organizationId, customerId, distance, notes, req.user.userId]
    );

    const quote = quoteResult.rows[0];

    // Add line items if provided
    if (items.length > 0) {
      for (const item of items) {
        await db.query(
          `INSERT INTO quote_items (quote_id, product_id, cases, margin_percent, unit_cost, freight_cost, line_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [quoteId, item.productId, item.cases, item.marginPercent, item.unitCost, item.freightCost, item.lineTotal]
        );
      }
    }

    res.status(201).json({ quote });

  } catch (error) {
    console.error('Create quote error:', error);
    res.status(500).json({ error: 'Failed to create quote' });
  }
});

/**
 * PUT /api/quotes/:id
 * 
 * Update a quote
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { customerId, distance, notes, items } = req.body;

    // Check ownership
    const existing = await db.query(
      'SELECT id FROM quotes WHERE id = $1 AND organization_id = $2',
      [id, req.user.organizationId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Update quote
    await db.query(
      `UPDATE quotes SET customer_id = $1, distance = $2, notes = $3, updated_at = NOW()
       WHERE id = $4`,
      [customerId, distance, notes, id]
    );

    // Update items if provided
    if (items) {
      // Delete existing items
      await db.query('DELETE FROM quote_items WHERE quote_id = $1', [id]);

      // Insert new items
      for (const item of items) {
        await db.query(
          `INSERT INTO quote_items (quote_id, product_id, cases, margin_percent, unit_cost, freight_cost, line_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, item.productId, item.cases, item.marginPercent, item.unitCost, item.freightCost, item.lineTotal]
        );
      }
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Update quote error:', error);
    res.status(500).json({ error: 'Failed to update quote' });
  }
});

/**
 * POST /api/quotes/:id/finalize
 * 
 * Mark a quote as sent/finalized
 */
router.post('/:id/finalize', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE quotes SET status = 'sent', sent_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [id, req.user.organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    res.json({ quote: result.rows[0] });

  } catch (error) {
    console.error('Finalize quote error:', error);
    res.status(500).json({ error: 'Failed to finalize quote' });
  }
});

/**
 * DELETE /api/quotes/:id
 * 
 * Delete a quote
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Delete items first (cascade should handle this, but being explicit)
    await db.query('DELETE FROM quote_items WHERE quote_id = $1', [id]);

    const result = await db.query(
      'DELETE FROM quotes WHERE id = $1 AND organization_id = $2 RETURNING id',
      [id, req.user.organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Delete quote error:', error);
    res.status(500).json({ error: 'Failed to delete quote' });
  }
});

module.exports = router;
