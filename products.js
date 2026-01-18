/**
 * Products Routes
 * 
 * CRUD operations for product catalog management.
 * Includes bulk import functionality.
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const db = require('../db/connection');

router.use(requireAuth);

/**
 * GET /api/products
 */
router.get('/', async (req, res) => {
  try {
    const { category, bipoc, available, search } = req.query;
    
    let query = 'SELECT * FROM products WHERE organization_id = $1';
    const params = [req.user.organizationId];
    let paramIndex = 2;

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (bipoc === 'true') {
      query += ' AND bipoc = true';
    }

    if (available !== 'false') {
      query += ' AND available = true';
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR farm ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ' ORDER BY category, name';

    const result = await db.query(query, params);
    res.json({ products: result.rows });

  } catch (error) {
    console.error('List products error:', error);
    res.status(500).json({ error: 'Failed to list products' });
  }
});

/**
 * GET /api/products/categories
 */
router.get('/categories', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT DISTINCT category FROM products WHERE organization_id = $1 ORDER BY category',
      [req.user.organizationId]
    );
    res.json({ categories: result.rows.map(r => r.category) });
  } catch (error) {
    console.error('List categories error:', error);
    res.status(500).json({ error: 'Failed to list categories' });
  }
});

/**
 * GET /api/products/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM products WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.user.organizationId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ product: result.rows[0] });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to get product' });
  }
});

/**
 * POST /api/products
 */
router.post('/', async (req, res) => {
  try {
    const { 
      name, unitType, casesPerPallet, costPerCase, weight,
      farm, location, category, bipoc, gapCertified, available 
    } = req.body;

    if (!name || !costPerCase) {
      return res.status(400).json({ error: 'Name and cost per case are required' });
    }

    const result = await db.query(
      `INSERT INTO products (id, organization_id, name, unit_type, cases_per_pallet, cost_per_case, weight,
       farm, location, category, bipoc, gap_certified, available)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [uuidv4(), req.user.organizationId, name, unitType, casesPerPallet, costPerCase, weight,
       farm, location, category, bipoc || false, gapCertified || false, available !== false]
    );

    res.status(201).json({ product: result.rows[0] });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

/**
 * POST /api/products/import
 * 
 * Bulk import products from CSV/JSON data
 */
router.post('/import', async (req, res) => {
  try {
    const { products, mode = 'merge' } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Products array is required' });
    }

    let imported = 0;
    let updated = 0;
    let errors = [];

    // If mode is 'replace', delete existing products first
    if (mode === 'replace') {
      await db.query('DELETE FROM products WHERE organization_id = $1', [req.user.organizationId]);
    }

    for (const product of products) {
      try {
        // Check if product exists (by name + farm combination)
        const existing = await db.query(
          'SELECT id FROM products WHERE organization_id = $1 AND name = $2 AND farm = $3',
          [req.user.organizationId, product.name, product.farm]
        );

        if (existing.rows.length > 0 && mode === 'merge') {
          // Update existing
          await db.query(
            `UPDATE products SET unit_type = $1, cases_per_pallet = $2, cost_per_case = $3, weight = $4,
             location = $5, category = $6, bipoc = $7, gap_certified = $8, available = $9, updated_at = NOW()
             WHERE id = $10`,
            [product.unitType, product.casesPerPallet, product.costPerCase, product.weight,
             product.location, product.category, product.bipoc || false, product.gapCertified || false,
             product.available !== false, existing.rows[0].id]
          );
          updated++;
        } else {
          // Insert new
          await db.query(
            `INSERT INTO products (id, organization_id, name, unit_type, cases_per_pallet, cost_per_case, weight,
             farm, location, category, bipoc, gap_certified, available)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [uuidv4(), req.user.organizationId, product.name, product.unitType, product.casesPerPallet,
             product.costPerCase, product.weight, product.farm, product.location, product.category,
             product.bipoc || false, product.gapCertified || false, product.available !== false]
          );
          imported++;
        }
      } catch (err) {
        errors.push({ product: product.name, error: err.message });
      }
    }

    res.json({ 
      success: true, 
      imported, 
      updated, 
      errors: errors.length > 0 ? errors : undefined 
    });

  } catch (error) {
    console.error('Import products error:', error);
    res.status(500).json({ error: 'Failed to import products' });
  }
});

/**
 * PUT /api/products/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { 
      name, unitType, casesPerPallet, costPerCase, weight,
      farm, location, category, bipoc, gapCertified, available 
    } = req.body;

    const result = await db.query(
      `UPDATE products SET name = $1, unit_type = $2, cases_per_pallet = $3, cost_per_case = $4, weight = $5,
       farm = $6, location = $7, category = $8, bipoc = $9, gap_certified = $10, available = $11, updated_at = NOW()
       WHERE id = $12 AND organization_id = $13
       RETURNING *`,
      [name, unitType, casesPerPallet, costPerCase, weight, farm, location, category,
       bipoc, gapCertified, available, req.params.id, req.user.organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product: result.rows[0] });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

/**
 * DELETE /api/products/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM products WHERE id = $1 AND organization_id = $2 RETURNING id',
      [req.params.id, req.user.organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
