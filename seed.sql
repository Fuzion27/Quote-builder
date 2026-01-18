-- Saba Quote Builder - Seed Data
-- Run this after schema.sql to populate initial data

-- =====================================================
-- Create Saba Grocers organization
-- =====================================================
INSERT INTO organizations (id, name) VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Saba Grocers Initiative');

-- =====================================================
-- Create admin user (password: 'password123')
-- =====================================================
INSERT INTO users (id, organization_id, email, password_hash, name, role) VALUES 
    ('22222222-2222-2222-2222-222222222222', 
     '11111111-1111-1111-1111-111111111111',
     'admin@sabagrocers.org',
     'a3f5b8c9d1e2f3a4b5c6d7e8f9a0b1c2:e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7',
     'Cameron',
     'admin');

-- =====================================================
-- Create default pricing settings
-- =====================================================
INSERT INTO pricing_settings (organization_id, settings) VALUES 
    ('11111111-1111-1111-1111-111111111111', '{
        "baseFreightRate": 125,
        "perMileRate": 0.85,
        "palletBreakSurcharge": 15,
        "minFreight": 75,
        "marginFoodBank": 20,
        "marginSchool": 15,
        "marginCorporate": 25,
        "volumeTiers": [
            {"minCases": 0, "maxCases": 50, "discount": 0},
            {"minCases": 51, "maxCases": 150, "discount": 8},
            {"minCases": 151, "maxCases": 300, "discount": 15},
            {"minCases": 301, "maxCases": 9999, "discount": 22}
        ],
        "regions": [
            {"id": "east-bay", "name": "East Bay", "distance": 25},
            {"id": "sf", "name": "San Francisco", "distance": 40},
            {"id": "south-bay", "name": "South Bay", "distance": 55},
            {"id": "central-coast", "name": "Central Coast", "distance": 120},
            {"id": "sacramento", "name": "Sacramento", "distance": 85},
            {"id": "central-valley", "name": "Central Valley", "distance": 150},
            {"id": "socal", "name": "Southern California", "distance": 400}
        ]
    }');

-- =====================================================
-- Create sample customers
-- =====================================================
INSERT INTO customers (organization_id, name, type, region_id, contact_email) VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Alameda Food Bank', 'Food Bank', 'east-bay', 'orders@alamedafoodbank.org'),
    ('11111111-1111-1111-1111-111111111111', 'Contra Costa Food Bank', 'Food Bank', 'east-bay', 'orders@ccfoodbank.org'),
    ('11111111-1111-1111-1111-111111111111', 'SFUSD Nutrition Services', 'School District', 'sf', 'nutrition@sfusd.edu'),
    ('11111111-1111-1111-1111-111111111111', 'Hayward Unified School District', 'School District', 'east-bay', 'foodservices@husd.k12.ca.us'),
    ('11111111-1111-1111-1111-111111111111', 'Feeding America San Bernardino', 'Food Bank', 'socal', 'procurement@feedingamericaie.org'),
    ('11111111-1111-1111-1111-111111111111', 'Food Bank of Monterey', 'Food Bank', 'central-coast', 'orders@foodbankformontereycounty.org'),
    ('11111111-1111-1111-1111-111111111111', 'Sacramento City USD', 'School District', 'sacramento', 'nutrition@scusd.edu');

-- =====================================================
-- Create sample products
-- =====================================================
INSERT INTO products (organization_id, name, unit_type, cases_per_pallet, cost_per_case, weight, farm, location, category, bipoc, gap_certified) VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Apples, Gala', '125ct', 49, 26.95, 40, 'Sambado and Sons', 'Linden', 'Fruits', FALSE, TRUE),
    ('11111111-1111-1111-1111-111111111111', 'Mandarins (Bagged)', '10-3lb', 60, 27.95, 30, 'Trinity Company', 'Fresno', 'Fruits', FALSE, FALSE),
    ('11111111-1111-1111-1111-111111111111', 'Mandarins (Bagged)', '15-2lb', 60, 26.50, 30, 'Bari Produce', 'Fresno', 'Fruits', FALSE, FALSE),
    ('11111111-1111-1111-1111-111111111111', 'Mandarins', '37lb', 25, 25.50, 37, 'Royal Blue Farms', 'Fresno', 'Fruits', TRUE, TRUE),
    ('11111111-1111-1111-1111-111111111111', 'Mandarins, Dekopon (VF)', '25lb', 80, 28.95, 25, 'Kingsburg Orchards', 'Kingsburg', 'Fruits', FALSE, FALSE),
    ('11111111-1111-1111-1111-111111111111', 'Dates, Medjool', '4 lb', 540, 24.00, 4, 'Gamil', 'Coachella', 'Fruits', TRUE, FALSE),
    ('11111111-1111-1111-1111-111111111111', 'Dates, Medjool', '11 lb', 220, 45.00, 11, 'Gamil', 'Coachella', 'Fruits', TRUE, FALSE),
    ('11111111-1111-1111-1111-111111111111', 'Pears, Bosc', '36lb', 56, 15.00, 36, 'Scully Pears', 'Finley', 'Fruits', FALSE, TRUE),
    ('11111111-1111-1111-1111-111111111111', 'Onions, Yellow', '50 lb', 35, 42.00, 50, 'Catalan Farm', 'Hollister', 'Vegetables', TRUE, FALSE),
    ('11111111-1111-1111-1111-111111111111', 'Potatoes, Red', '50 lb', 35, 55.00, 50, 'Catalan Farm', 'Hollister', 'Vegetables', TRUE, FALSE),
    ('11111111-1111-1111-1111-111111111111', 'Spring Mix', '3 lb', 140, 8.00, 3, 'Jayleaf', 'Hollister', 'Vegetables', TRUE, TRUE),
    ('11111111-1111-1111-1111-111111111111', 'Baby Spinach', '4 lb', 140, 10.50, 4, 'Jayleaf', 'Hollister', 'Vegetables', TRUE, TRUE),
    ('11111111-1111-1111-1111-111111111111', 'Wild Arugula', '4 lb', 140, 11.50, 4, 'Jayleaf', 'Hollister', 'Vegetables', TRUE, TRUE),
    ('11111111-1111-1111-1111-111111111111', 'Broccolini, Baby', '18 lb', 70, 36.00, 18, 'Induchucuiti Organic Farms', 'Aromas', 'Vegetables', TRUE, TRUE),
    ('11111111-1111-1111-1111-111111111111', 'Broccoli', '14ct', 48, 52.75, 23, 'Braga Fresh', 'Soledad', 'Vegetables', FALSE, TRUE),
    ('11111111-1111-1111-1111-111111111111', 'Celery', '30ct', 32, 40.00, 55, 'Community Farmers', 'Watsonville', 'Vegetables', TRUE, FALSE),
    ('11111111-1111-1111-1111-111111111111', 'Sweet Potatoes, Orange', '40 lb', 54, 34.20, 40, 'Kandola Farms', 'Livingston', 'Vegetables', TRUE, FALSE),
    ('11111111-1111-1111-1111-111111111111', 'Apple Pears', '30 lb', 64, 19.00, 30, 'Kingsburg Orchards', 'Fresno', 'Specialty', FALSE, TRUE),
    ('11111111-1111-1111-1111-111111111111', 'Oranges, Blood 88ct', '40 lb', 54, 24.50, 40, 'Trinity Company', 'Fresno', 'Specialty', FALSE, FALSE),
    ('11111111-1111-1111-1111-111111111111', 'Oranges, Cara Cara', '40 lb', 54, 22.50, 40, 'Trinity Company', 'Fresno', 'Specialty', FALSE, FALSE);

-- =====================================================
-- Verify data
-- =====================================================
SELECT 'Organizations:' as info, COUNT(*) as count FROM organizations
UNION ALL
SELECT 'Users:', COUNT(*) FROM users
UNION ALL
SELECT 'Customers:', COUNT(*) FROM customers
UNION ALL
SELECT 'Products:', COUNT(*) FROM products
UNION ALL
SELECT 'Pricing Settings:', COUNT(*) FROM pricing_settings;
