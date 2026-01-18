/**
 * Customers Routes
 * 
 * CRUD operations for customer management.
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const db = require('../db/connection');

router.use(requireAuth);

/**
 * GET /api/customers
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM customers WHERE organization_id = $1 ORDER BY name`,
      [req.user.organizationId]
    );
    res.json({ customers: result.rows });
  } catch (error) {
    console.error('List customers error:', error);
    res.status(500).json({ error: 'Failed to list customers' });
  }
});

/**
 * GET /api/customers/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM customers WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.user.organizationId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({ customer: result.rows[0] });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ error: 'Failed to get customer' });
  }
});

/**
 * POST /api/customers
 */
router.post('/', async (req, res) => {
  try {
    const { name, type, regionId, address, contactEmail, contactPhone, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    const result = await db.query(
      `INSERT INTO customers (id, organization_id, name, type, region_id, address, contact_email, contact_phone, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [uuidv4(), req.user.organizationId, name, type, regionId, address, contactEmail, contactPhone, notes]
    );

    res.status(201).json({ customer: result.rows[0] });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

/**
 * PUT /api/customers/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, type, regionId, address, contactEmail, contactPhone, notes } = req.body;

    const result = await db.query(
      `UPDATE customers SET name = $1, type = $2, region_id = $3, address = $4, 
       contact_email = $5, contact_phone = $6, notes = $7, updated_at = NOW()
       WHERE id = $8 AND organization_id = $9
       RETURNING *`,
      [name, type, regionId, address, contactEmail, contactPhone, notes, req.params.id, req.user.organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ customer: result.rows[0] });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

/**
 * DELETE /api/customers/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM customers WHERE id = $1 AND organization_id = $2 RETURNING id',
      [req.params.id, req.user.organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

module.exports = router;
