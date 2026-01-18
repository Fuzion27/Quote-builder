/**
 * Settings Routes
 * 
 * Manages organization-specific pricing settings.
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const db = require('../db/connection');

router.use(requireAuth);

/**
 * GET /api/settings
 * 
 * Get pricing settings for the user's organization
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT settings FROM pricing_settings WHERE organization_id = $1',
      [req.user.organizationId]
    );

    if (result.rows.length === 0) {
      // Return default settings if none exist
      return res.json({ settings: getDefaultSettings() });
    }

    res.json({ settings: result.rows[0].settings });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

/**
 * PUT /api/settings
 * 
 * Update pricing settings
 */
router.put('/', async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings) {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    // Validate settings structure
    const validationError = validateSettings(settings);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    // Upsert settings
    await db.query(
      `INSERT INTO pricing_settings (organization_id, settings, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (organization_id) 
       DO UPDATE SET settings = $2, updated_at = NOW()`,
      [req.user.organizationId, JSON.stringify(settings)]
    );

    res.json({ success: true, settings });

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * GET /api/settings/regions
 * 
 * Get just the regions list
 */
router.get('/regions', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT settings FROM pricing_settings WHERE organization_id = $1',
      [req.user.organizationId]
    );

    const settings = result.rows.length > 0 ? result.rows[0].settings : getDefaultSettings();
    
    res.json({ regions: settings.regions || [] });

  } catch (error) {
    console.error('Get regions error:', error);
    res.status(500).json({ error: 'Failed to get regions' });
  }
});

/**
 * GET /api/settings/volume-tiers
 * 
 * Get just the volume discount tiers
 */
router.get('/volume-tiers', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT settings FROM pricing_settings WHERE organization_id = $1',
      [req.user.organizationId]
    );

    const settings = result.rows.length > 0 ? result.rows[0].settings : getDefaultSettings();
    
    res.json({ volumeTiers: settings.volumeTiers || [] });

  } catch (error) {
    console.error('Get volume tiers error:', error);
    res.status(500).json({ error: 'Failed to get volume tiers' });
  }
});

/**
 * POST /api/settings/reset
 * 
 * Reset settings to defaults
 */
router.post('/reset', async (req, res) => {
  try {
    const defaultSettings = getDefaultSettings();

    await db.query(
      `INSERT INTO pricing_settings (organization_id, settings, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (organization_id) 
       DO UPDATE SET settings = $2, updated_at = NOW()`,
      [req.user.organizationId, JSON.stringify(defaultSettings)]
    );

    res.json({ success: true, settings: defaultSettings });

  } catch (error) {
    console.error('Reset settings error:', error);
    res.status(500).json({ error: 'Failed to reset settings' });
  }
});

// Helper functions
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
      { id: 'sacramento', name: 'Sacramento', distance: 85 },
      { id: 'central-valley', name: 'Central Valley', distance: 150 },
      { id: 'socal', name: 'Southern California', distance: 400 }
    ]
  };
}

function validateSettings(settings) {
  if (typeof settings.baseFreightRate !== 'number' || settings.baseFreightRate < 0) {
    return 'Base freight rate must be a non-negative number';
  }
  if (typeof settings.perMileRate !== 'number' || settings.perMileRate < 0) {
    return 'Per-mile rate must be a non-negative number';
  }
  if (typeof settings.palletBreakSurcharge !== 'number' || settings.palletBreakSurcharge < 0) {
    return 'Pallet break surcharge must be a non-negative number';
  }
  if (!Array.isArray(settings.volumeTiers)) {
    return 'Volume tiers must be an array';
  }
  if (!Array.isArray(settings.regions)) {
    return 'Regions must be an array';
  }
  return null;
}

module.exports = router;
