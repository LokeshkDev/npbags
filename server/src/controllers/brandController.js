const { query } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * GET /api/admin/brands
 * Retrieves all active brands with associated product counts.
 */
async function getAllBrands(req, res, next) {
  try {
    const brands = await query(`
      SELECT id, name, logo_url, sort_order, is_active
      FROM brands
      WHERE is_active = 1
      ORDER BY sort_order ASC, name ASC
    `);

    // Safely tally product counts in memory without collation mismatch or join locks
    let productCounts = {};
    try {
      const pRows = await query(`SELECT brand FROM products WHERE brand IS NOT NULL AND TRIM(brand) != ''`);
      (pRows || []).forEach(p => {
        const bKey = String(p.brand || '').trim().toLowerCase();
        if (bKey) productCounts[bKey] = (productCounts[bKey] || 0) + 1;
      });
    } catch (countErr) {
      console.warn('Could not fetch brand product counts:', countErr.message);
    }

    const result = (brands || []).map(b => ({
      ...b,
      product_count: productCounts[String(b.name || '').trim().toLowerCase()] || 0
    }));

    return sendSuccess(res, result, 'Brands retrieved successfully');
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
      'SELECT id, name, logo_url, is_active FROM brands WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
      [cleanName]
    );

    if (existing && existing.length > 0) {
      const brand = existing[0];
      if (Number(brand.is_active) === 0) {
        await query('UPDATE brands SET is_active = 1 WHERE id = ?', [brand.id]);
      }
      return sendSuccess(res, { ...brand, is_active: 1 }, 'Brand already exists and is active', 200);
    }

    try {
      const result = await query(
        'INSERT INTO brands (name, logo_url, is_active) VALUES (?, ?, 1)',
        [cleanName, logo_url ? String(logo_url).trim() : '']
      );

      const newBrand = {
        id: result.insertId,
        name: cleanName,
        logo_url: logo_url || '',
        is_active: 1,
        product_count: 0
      };

      return sendSuccess(res, newBrand, 'Brand created successfully', 201);
    } catch (insertErr) {
      if (insertErr.code === 'ER_DUP_ENTRY' || (insertErr.message && insertErr.message.includes('Duplicate entry'))) {
        const fallbackRows = await query(
          'SELECT id, name, logo_url, is_active FROM brands WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
          [cleanName]
        );
        if (fallbackRows && fallbackRows.length > 0) {
          await query('UPDATE brands SET is_active = 1 WHERE id = ?', [fallbackRows[0].id]);
          return sendSuccess(res, { ...fallbackRows[0], is_active: 1 }, 'Brand already exists and is active', 200);
        }
      }
      throw insertErr;
    }
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
      try {
        await query(
          'UPDATE products SET brand = ? WHERE TRIM(brand) = ?',
          [cleanName, oldName.trim()]
        );
      } catch (prodSyncErr) {
        console.warn('Could not update products brand:', prodSyncErr.message);
      }
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

    const brandName = currentRows[0].name;

    // Hard delete
    await query('DELETE FROM brands WHERE id = ?', [id]);

    return sendSuccess(res, { id: parseInt(id, 10), name: brandName }, 'Brand deleted successfully');
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
