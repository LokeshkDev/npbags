/**
 * Barcode Controller for NP Grand Shopping
 * Handles barcode generation, product barcode listings, hardware scanner lookups, and SVG rendering.
 */

const { query } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const {
  generateBarcodeSVG,
  generateProductBarcodes
} = require('../utils/barcode');

// Admin: Get all barcodes assigned to a product (primary + variants)
async function getProductBarcodes(req, res, next) {
  try {
    const { id: productId } = req.params;

    const barcodes = await query(
      `SELECT pb.*, pv.sku, pv.color_name, pv.size_name, pv.stock_quantity,
              p.name AS product_name, p.mrp, p.purchase_price, p.purchased_rate
       FROM product_barcodes pb
       JOIN products p ON pb.product_id = p.id
       LEFT JOIN product_variants pv ON pb.variant_id = pv.id
       WHERE pb.product_id = ?
       ORDER BY pb.is_primary DESC, pb.id ASC`,
      [productId]
    );

    // Attach rendered SVG markup to each barcode
    const formatted = barcodes.map(b => ({
      ...b,
      svg: generateBarcodeSVG(b.barcode, { height: 45, moduleWidth: 2 })
    }));

    return sendSuccess(res, formatted);
  } catch (error) {
    next(error);
  }
}

// Admin: Generate/Ensure barcodes for a product and its variants
async function generateBarcodesForProduct(req, res, next) {
  try {
    const { id: productId } = req.params;

    const prods = await query(`SELECT * FROM products WHERE id = ?`, [productId]);
    if (prods.length === 0) {
      return sendError(res, 'Product not found', 404);
    }

    const variants = await query(`SELECT * FROM product_variants WHERE product_id = ?`, [productId]);
    const userId = req.user ? req.user.id : null;

    const generated = await generateProductBarcodes(productId, variants, userId, { query });

    // Fetch the full active list after generation
    const barcodes = await query(
      `SELECT pb.*, pv.sku, pv.color_name, pv.size_name, pv.stock_quantity,
              p.name AS product_name, p.mrp, p.purchase_price, p.purchased_rate
       FROM product_barcodes pb
       JOIN products p ON pb.product_id = p.id
       LEFT JOIN product_variants pv ON pb.variant_id = pv.id
       WHERE pb.product_id = ? AND pb.status = 'active'
       ORDER BY pb.is_primary DESC, pb.id ASC`,
      [productId]
    );

    const formatted = barcodes.map(b => ({
      ...b,
      svg: generateBarcodeSVG(b.barcode, { height: 45, moduleWidth: 2 })
    }));

    return sendSuccess(res, { generated, barcodes: formatted }, 'Barcodes synchronized successfully');
  } catch (error) {
    next(error);
  }
}

// Scanner & POS: Fast Lookup by Barcode String (e.g. 'NP-1048' or variant SKU)
async function lookupBarcode(req, res, next) {
  try {
    const rawCode = req.query.code || req.params.code;
    if (!rawCode || !rawCode.trim()) {
      return sendError(res, 'Barcode is required', 400);
    }

    const code = rawCode.trim();

    // 1. Direct barcode match in product_barcodes
    const barcodeRows = await query(
      `SELECT pb.*, p.name AS product_name, p.slug, p.price, p.sale_price, p.hsn_code,
              p.barcode_short_name, p.mrp, p.purchase_price, p.purchased_rate,
              pv.id AS variant_id, pv.sku, pv.color_name, pv.color_hex,
              pv.size_name, pv.stock_quantity, pv.image_url AS variant_image
       FROM product_barcodes pb
       JOIN products p ON pb.product_id = p.id
       LEFT JOIN product_variants pv ON pb.variant_id = pv.id
       WHERE pb.barcode = ? AND pb.status = 'active'
       LIMIT 1`,
      [code]
    );

    if (barcodeRows.length > 0) {
      const row = barcodeRows[0];

      // Get primary image if variant image not available
      let displayImage = row.variant_image;
      if (!displayImage) {
        const imgs = await query(
          `SELECT image_url FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, display_order ASC LIMIT 1`,
          [row.product_id]
        );
        displayImage = imgs[0]?.image_url || '/assets/bestsellers/best-handbag.png';
      }

      const effectivePrice = row.sale_price > 0 ? parseFloat(row.sale_price) : parseFloat(row.price);

      return sendSuccess(res, {
        found_by: 'barcode',
        barcode: row.barcode,
        svg: generateBarcodeSVG(row.barcode, { height: 45, moduleWidth: 2 }),
        is_primary: Boolean(row.is_primary),
        product_id: row.product_id,
        product_name: row.product_name,
        slug: row.slug,
        barcode_short_name: row.barcode_short_name || row.product_name,
        barcode_sequence: row.barcode_sequence || null,
        mrp: row.mrp !== null && row.mrp !== undefined ? parseFloat(row.mrp) : null,
        purchase_price: row.purchase_price !== null && row.purchase_price !== undefined ? parseFloat(row.purchase_price) : null,
        purchased_rate: row.purchased_rate || (row.purchase_price !== null && row.purchase_price !== undefined ? String(parseFloat(row.purchase_price)) : null),
        price: effectivePrice,
        regular_price: parseFloat(row.price),
        sale_price: row.sale_price > 0 ? parseFloat(row.sale_price) : null,
        hsn_code: row.hsn_code || '4202',
        image: displayImage,
        variant: row.variant_id ? {
          id: row.variant_id,
          sku: row.sku,
          color: row.color_name,
          color_hex: row.color_hex,
          size: row.size_name,
          stock: row.stock_quantity
        } : null,
        stock_quantity: row.stock_quantity !== undefined && row.stock_quantity !== null ? row.stock_quantity : 50
      });
    }

    // 2. Fallback: Lookup by variant SKU
    const skuRows = await query(
      `SELECT pv.*, p.name AS product_name, p.slug, p.price, p.sale_price, p.hsn_code, p.barcode_short_name,
              p.mrp, p.purchase_price, p.purchased_rate
       FROM product_variants pv
       JOIN products p ON pv.product_id = p.id
       WHERE pv.sku = ?
       LIMIT 1`,
      [code]
    );

    if (skuRows.length > 0) {
      const row = skuRows[0];
      const imgs = await query(
        `SELECT image_url FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, display_order ASC LIMIT 1`,
        [row.product_id]
      );
      const displayImage = row.image_url || imgs[0]?.image_url || '/assets/bestsellers/best-handbag.png';
      const effectivePrice = row.sale_price > 0 ? parseFloat(row.sale_price) : parseFloat(row.price);

      return sendSuccess(res, {
        found_by: 'sku',
        barcode: code,
        svg: generateBarcodeSVG(code, { height: 45, moduleWidth: 2 }),
        is_primary: false,
        product_id: row.product_id,
        product_name: row.product_name,
        slug: row.slug,
        barcode_short_name: row.barcode_short_name || row.product_name,
        barcode_sequence: null,
        mrp: row.mrp !== null && row.mrp !== undefined ? parseFloat(row.mrp) : null,
        purchase_price: row.purchase_price !== null && row.purchase_price !== undefined ? parseFloat(row.purchase_price) : null,
        purchased_rate: row.purchased_rate || (row.purchase_price !== null && row.purchase_price !== undefined ? String(parseFloat(row.purchase_price)) : null),
        price: effectivePrice,
        regular_price: parseFloat(row.price),
        hsn_code: row.hsn_code || '4202',
        image: displayImage,
        variant: {
          id: row.id,
          sku: row.sku,
          color: row.color_name,
          color_hex: row.color_hex,
          size: row.size_name,
          stock: row.stock_quantity
        },
        stock_quantity: row.stock_quantity
      });
    }

    // 3. Fallback: Lookup directly on products table by id or exact slug
    const prodRows = await query(
      `SELECT p.*,
              (SELECT barcode FROM product_barcodes WHERE product_id = p.id AND is_primary = 1 AND status = 'active' LIMIT 1) AS primary_barcode
       FROM products p
       WHERE (p.id = ? OR p.slug = ?) AND p.is_active = TRUE
       LIMIT 1`,
      [code, code]
    );

    if (prodRows.length > 0) {
      const p = prodRows[0];
      const imgs = await query(
        `SELECT image_url FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, display_order ASC LIMIT 1`,
        [p.id]
      );
      const displayImage = imgs[0]?.image_url || '/assets/bestsellers/best-handbag.png';
      const effectivePrice = p.sale_price > 0 ? parseFloat(p.sale_price) : parseFloat(p.price);
      const effectiveBarcode = p.primary_barcode || `NP-${p.id}`;

      return sendSuccess(res, {
        found_by: 'product',
        barcode: effectiveBarcode,
        svg: generateBarcodeSVG(effectiveBarcode, { height: 45, moduleWidth: 2 }),
        is_primary: true,
        product_id: p.id,
        product_name: p.name,
        slug: p.slug,
        barcode_short_name: p.barcode_short_name || p.name,
        price: effectivePrice,
        regular_price: parseFloat(p.price),
        hsn_code: p.hsn_code || '4202',
        image: displayImage,
        variant: null,
        stock_quantity: p.stock || 50
      });
    }

    // 4. Fallback: Fuzzy match by product name if length >= 2
    if (code.length >= 2) {
      const nameRows = await query(
        `SELECT p.*,
                (SELECT barcode FROM product_barcodes WHERE product_id = p.id AND is_primary = 1 AND status = 'active' LIMIT 1) AS primary_barcode
         FROM products p
         WHERE p.name LIKE ? AND p.is_active = TRUE
         ORDER BY p.is_featured DESC, p.created_at DESC
         LIMIT 1`,
        [`%${code}%`]
      );

      if (nameRows.length > 0) {
        const p = nameRows[0];
        const imgs = await query(
          `SELECT image_url FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, display_order ASC LIMIT 1`,
          [p.id]
        );
        const displayImage = imgs[0]?.image_url || '/assets/bestsellers/best-handbag.png';
        const effectivePrice = p.sale_price > 0 ? parseFloat(p.sale_price) : parseFloat(p.price);
        const effectiveBarcode = p.primary_barcode || `NP-${p.id}`;

        return sendSuccess(res, {
          found_by: 'name_match',
          barcode: effectiveBarcode,
          svg: generateBarcodeSVG(effectiveBarcode, { height: 45, moduleWidth: 2 }),
          is_primary: true,
          product_id: p.id,
          product_name: p.name,
          slug: p.slug,
          barcode_short_name: p.barcode_short_name || p.name,
          barcode_sequence: null,
          mrp: p.mrp !== null && p.mrp !== undefined ? parseFloat(p.mrp) : null,
          purchase_price: p.purchase_price !== null && p.purchase_price !== undefined ? parseFloat(p.purchase_price) : null,
          purchased_rate: p.purchased_rate || (p.purchase_price !== null && p.purchase_price !== undefined ? String(parseFloat(p.purchase_price)) : null),
          price: effectivePrice,
          regular_price: parseFloat(p.price),
          hsn_code: p.hsn_code || '4202',
          image: displayImage,
          variant: null,
          stock_quantity: p.stock || 50
        });
      }
    }

    return sendError(res, `No item found matching barcode or SKU '${code}'`, 404);
  } catch (error) {
    next(error);
  }
}

// Admin: Deactivate a barcode
async function deactivateBarcode(req, res, next) {
  try {
    const { id } = req.params;
    await query(`UPDATE product_barcodes SET status = 'inactive' WHERE id = ?`, [id]);
    return sendSuccess(res, { id }, 'Barcode deactivated');
  } catch (error) {
    next(error);
  }
}

// Generate standalone SVG for print/label embedding
async function getBarcodeSvg(req, res, next) {
  try {
    const { code } = req.params;
    const height = parseInt(req.query.height, 10) || 50;
    const moduleWidth = parseFloat(req.query.width) || 2;
    const svg = generateBarcodeSVG(code, { height, moduleWidth });
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(svg);
  } catch (error) {
    next(error);
  }
}

// Admin: Get all generated barcodes across all products
async function getAllBarcodesAdmin(req, res, next) {
  try {
    const { search, limit = 200, page = 1 } = req.query;
    let sql = `
      SELECT pb.*, p.name AS product_name, p.price, p.sale_price, p.hsn_code,
             p.barcode_short_name, p.mrp, p.purchase_price, p.purchased_rate,
             pv.sku, pv.color_name, pv.size_name, pv.stock_quantity
      FROM product_barcodes pb
      JOIN products p ON pb.product_id = p.id
      LEFT JOIN product_variants pv ON pb.variant_id = pv.id
      WHERE pb.status = 'active'
    `;
    const params = [];
    if (search && search.trim()) {
      sql += ` AND (pb.barcode LIKE ? OR p.name LIKE ? OR pv.sku LIKE ? OR p.barcode_short_name LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }
    sql += ` ORDER BY pb.is_primary DESC, pb.id DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), (parseInt(page, 10) - 1) * parseInt(limit, 10));

    const barcodes = await query(sql, params);
    const formatted = barcodes.map(b => ({
      ...b,
      svg: generateBarcodeSVG(b.barcode, { height: 40, moduleWidth: 2 })
    }));

    return sendSuccess(res, formatted);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getProductBarcodes,
  generateBarcodesForProduct,
  lookupBarcode,
  deactivateBarcode,
  getBarcodeSvg,
  getAllBarcodesAdmin
};

