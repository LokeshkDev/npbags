const { query } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * GET /api/admin/brands
 * Retrieves all active brands with associated product counts.
 */
async function getAllBrands(req, res, next) {
  try {
    const brands = await query(`
      SELECT 
        b.id,
        b.name,
        b.logo_url,
        b.sort_order,
        b.is_active,
        COUNT(p.id) AS product_count
      FROM brands b
      LEFT JOIN products p ON LOWER(TRIM(p.brand)) = LOWER(TRIM(b.name))
      WHERE b.is_active = 1
      GROUP BY b.id
      ORDER BY b.sort_order ASC, b.name ASC
    `);

    return sendSuccess(res, brands, 'Brands retrieved successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/admin/brands
 * Creates a new brand and ensures uniqueness.
 */
async function createBrand(req, res, next) {
  try {
    const { name, logo_url } = req.body;
    const cleanName = String(name || '').trim();

    if (!cleanName) {
      return sendError(res, 'Brand name is required.', 400);
    }

    // Check for duplicate (case-insensitive)
    const existing = await query(
      'SELECT id, name FROM brands WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
      [cleanName]
    );

    if (existing && existing.length > 0) {
      // If inactive, reactivate it
      await query('UPDATE brands SET is_active = 1 WHERE id = ?', [existing[0].id]);
      return sendSuccess(res, existing[0], 'Brand already exists and is active', 200);
    }

    const result = await query(
      'INSERT INTO brands (name, logo_url, is_active) VALUES (?, ?, 1)',
      [cleanName, logo_url ? String(logo_url).trim() : '']
    );

    const newBrand = {
      id: result.insertId,
      name: cleanName,
      logo_url: logo_url || '',
      product_count: 0
    };

    return sendSuccess(res, newBrand, 'Brand created successfully', 201);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/admin/brands/:id
 * Updates an existing brand and optionally updates products with that brand.
 */
async function updateBrand(req, res, next) {
  try {
    const { id } = req.params;
    const { name, logo_url } = req.body;
    const cleanName = String(name || '').trim();

    if (!cleanName) {
      return sendError(res, 'Brand name is required.', 400);
    }

    const currentRows = await query('SELECT id, name FROM brands WHERE id = ? LIMIT 1', [id]);
    if (!currentRows || currentRows.length === 0) {
      return sendError(res, 'Brand not found.', 404);
    }

    const oldName = currentRows[0].name;

    // Check if new name conflicts with another brand
    const duplicate = await query(
      'SELECT id FROM brands WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id != ? LIMIT 1',
      [cleanName, id]
    );
    if (duplicate && duplicate.length > 0) {
      return sendError(res, 'Another brand with this name already exists.', 409);
    }

    await query(
      'UPDATE brands SET name = ?, logo_url = COALESCE(?, logo_url) WHERE id = ?',
      [cleanName, logo_url !== undefined ? logo_url : null, id]
    );

    // Sync products that used the old brand name
    if (oldName && oldName.toLowerCase() !== cleanName.toLowerCase()) {
      await query(
        'UPDATE products SET brand = ? WHERE LOWER(TRIM(brand)) = LOWER(TRIM(?))',
        [cleanName, oldName]
      );
    }

    const updated = {
      id: parseInt(id, 10),
      name: cleanName,
      logo_url: logo_url || ''
    };

    return sendSuccess(res, updated, 'Brand updated successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/admin/brands/:id
 * Removes a brand from the master list.
 */
async function deleteBrand(req, res, next) {
  try {
    const { id } = req.params;
    const currentRows = await query('SELECT id, name FROM brands WHERE id = ? LIMIT 1', [id]);

    if (!currentRows || currentRows.length === 0) {
      return sendError(res, 'Brand not found.', 404);
    }

    // Hard delete or set is_active = 0
    await query('DELETE FROM brands WHERE id = ?', [id]);

    return sendSuccess(res, { id: parseInt(id, 10), name: currentRows[0].name }, 'Brand deleted successfully');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllBrands,
  createBrand,
  updateBrand,
  deleteBrand
};
