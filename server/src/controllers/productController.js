const slugify = require('slugify');
const { query } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { processUploadedFile, deleteUploadedFile } = require('../middleware/upload');
const { DEFAULT_PRODUCT_IMAGE } = require('../utils/productDefaults');

function normalizePurchaseRate(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeGstType(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['without_gst', 'exclusive', 'excl', 'without'].includes(normalized)) return 'exclusive';
  return 'inclusive';
}

function calculateProductCosting({ purchasePrice, mrp, price, salePrice, gstType, gstRate, landingCost, purchaseMargin, landingMargin }) {
  const pPrice = purchasePrice !== undefined && purchasePrice !== null && purchasePrice !== '' ? parseFloat(purchasePrice) : 0;
  const targetMrp = mrp !== undefined && mrp !== null && mrp !== '' ? parseFloat(mrp) : (parseFloat(salePrice || price) || 0);
  const sellPrice = parseFloat(salePrice || price) || 0;
  const rate = gstRate !== undefined && gstRate !== null && gstRate !== '' ? parseFloat(gstRate) : 18.0;
  const type = normalizeGstType(gstType);

  let landing = landingCost !== undefined && landingCost !== null && landingCost !== '' ? parseFloat(landingCost) : null;
  if ((landing === null || isNaN(landing)) && pPrice > 0) {
    landing = (type === 'exclusive' && rate > 0)
      ? Math.round(pPrice * (1 + rate / 100) * 100) / 100
      : pPrice;
  }

  let pMargin = purchaseMargin !== undefined && purchaseMargin !== null && purchaseMargin !== '' ? parseFloat(purchaseMargin) : null;
  if ((pMargin === null || isNaN(pMargin)) && targetMrp > 0 && landing !== null && landing > 0) {
    // Purchase Margin % INCLUDING GST %: ((MRP - Cost with GST) / MRP) * 100
    pMargin = Math.round(((targetMrp - landing) / targetMrp) * 100 * 10) / 10;
  }

  let lMargin = landingMargin !== undefined && landingMargin !== null && landingMargin !== '' ? parseFloat(landingMargin) : null;
  if ((lMargin === null || isNaN(lMargin)) && sellPrice > 0 && landing !== null && landing > 0) {
    lMargin = Math.round(((sellPrice - landing) / sellPrice) * 100 * 10) / 10;
  }

  return {
    landingCost: landing !== null && !isNaN(landing) ? landing : null,
    purchaseMargin: pMargin !== null && !isNaN(pMargin) ? pMargin : null,
    landingMargin: lMargin !== null && !isNaN(lMargin) ? lMargin : null
  };
}

async function recordPurchaseRateHistory(productId, oldRate, newRate, userId = null) {
  const previous = normalizePurchaseRate(oldRate);
  const next = normalizePurchaseRate(newRate);
  if (previous === next) return;
  try {
    await query(
      `INSERT INTO product_purchase_rate_history (product_id, old_rate, new_rate, changed_by)
       VALUES (?, ?, ?, ?)`,
      [productId, previous, next, userId || null]
    );
  } catch (error) {
    console.error('Could not record purchase rate history:', error.message);
  }
}

async function getAllProducts(req, res, next) {
  try {
    const {
      category,
      gender,
      minPrice,
      maxPrice,
      badge,
      availability,
      search,
      sort = 'featured',
      page = 1,
      limit = 24,
      is_featured,
      is_new_arrival,
      is_best_selling,
      status,
      is_active,
      channel,
      is_online,
      include_inactive,
      branch_id: queryBranchId
    } = req.query;

    const branch_id = queryBranchId || (req.user && req.user.role !== 'admin' ? req.user.branch_id : null);
    const isRegionalBranch = Boolean(branch_id && Number(branch_id) > 1);
    const params = [];

    let branchSelect = '';
    let branchJoin = '';
    if (branch_id) {
      branchSelect = `, COALESCE(bs.stock, 0) AS branch_stock, bs.low_stock_threshold AS branch_low_stock_threshold, COALESCE(bs.is_active, 0) AS is_branch_active`;
      if (isRegionalBranch && include_inactive !== '1' && include_inactive !== 'true' && req.query.include_inactive_branch !== '1') {
        // For regional branches, only return products that have been explicitly assigned and are active in this branch
        branchJoin = ` INNER JOIN branch_stocks bs ON bs.product_id = p.id AND bs.branch_id = ? AND bs.is_active = 1`;
      } else {
        branchJoin = ` LEFT JOIN branch_stocks bs ON bs.product_id = p.id AND bs.branch_id = ?`;
      }
      params.push(branch_id);
    }

    let sql = `
      SELECT p.*${branchSelect},
             (SELECT barcode FROM product_barcodes WHERE product_id = p.id AND is_primary = 1 AND status = 'active' LIMIT 1) AS barcode,
             c.name AS category_name, c.slug AS category_slug, c.parent_id,
             parent.slug AS parent_category_slug, parent.name AS parent_category_name,
             v.name AS vendor_name, v.company_name AS vendor_company_name
      FROM products p
      ${branchJoin}
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories parent ON c.parent_id = parent.id
      LEFT JOIN vendors v ON p.vendor_id = v.id
      WHERE 1=1
    `;

    // Status filter: Active vs Inactive (Admin can view all or filter, Storefront views active)
    if (status === 'inactive' || is_active === '0' || is_active === 'false') {
      sql += ` AND p.is_active = FALSE`;
    } else if (status === 'all' || include_inactive === '1' || include_inactive === 'true' || is_active === 'all') {
      // Include all (active and inactive) for admin
    } else {
      // Default: active products only
      sql += ` AND p.is_active = TRUE`;
    }

    // Channel filter: Online Storefront vs In-Store / Offline Only
    if (channel === 'offline' || is_online === '0' || is_online === 'false') {
      sql += ` AND p.is_online = FALSE`;
    } else if (channel === 'online' || is_online === '1' || is_online === 'true') {
      sql += ` AND (p.is_online = TRUE OR p.is_online IS NULL)`;
    } else if (status === 'all' || include_inactive === '1' || include_inactive === 'true' || is_active === 'all') {
      // Admin viewing all channels
    } else {
      // Default public storefront: only products enabled for online sale
      sql += ` AND (p.is_online = TRUE OR p.is_online IS NULL)`;
    }

    if (category && category !== 'all') {
      sql += ` AND (
        LOWER(c.slug) = LOWER(?) OR LOWER(c.name) = LOWER(?)
        OR LOWER(COALESCE(parent.slug, '')) = LOWER(?) OR LOWER(COALESCE(parent.name, '')) = LOWER(?)
      )`;
      params.push(category, category, category, category);
    }

    if (gender && gender !== 'all') {
      sql += ` AND (
        FIND_IN_SET(LOWER(?), REPLACE(LOWER(COALESCE(p.gender, 'all')), ' ', '')) > 0
        OR FIND_IN_SET(LOWER(?), REPLACE(LOWER(COALESCE(c.gender, 'all')), ' ', '')) > 0
        OR FIND_IN_SET(LOWER(?), REPLACE(LOWER(COALESCE(parent.gender, 'all')), ' ', '')) > 0
        OR p.gender = 'all' OR p.gender IS NULL OR c.gender = 'all' OR parent.gender = 'all'
      )`;
      params.push(gender, gender, gender);
    }

    if (minPrice) {
      sql += ` AND p.price >= ?`;
      params.push(parseFloat(minPrice));
    }

    if (maxPrice) {
      sql += ` AND p.price <= ?`;
      params.push(parseFloat(maxPrice));
    }

    if (badge && badge !== 'all') {
      sql += ` AND LOWER(p.badge) LIKE LOWER(?)`;
      params.push(`%${badge}%`);
    }

    if (availability === 'sale') {
      sql += ` AND p.sale_price > p.price`;
    } else if (availability === 'bestseller') {
      sql += ` AND (p.is_best_selling = TRUE OR LOWER(COALESCE(p.badge, '')) LIKE '%bestseller%' OR LOWER(COALESCE(p.badge, '')) LIKE '%best%')`;
    } else if (availability === 'new') {
      sql += ` AND (p.is_new_arrival = TRUE OR LOWER(COALESCE(p.badge, '')) LIKE '%new%')`;
    }

    if (is_featured === '1' || is_featured === 'true') {
      sql += ` AND p.is_featured = TRUE`;
    }

    if (is_new_arrival === '1' || is_new_arrival === 'true') {
      sql += ` AND p.is_new_arrival = TRUE`;
    }

    if (is_best_selling === '1' || is_best_selling === 'true') {
      sql += ` AND p.is_best_selling = TRUE`;
    }

    if (search) {
      const term = `%${search}%`;
      sql += ` AND (
        p.name LIKE ? OR p.tagline LIKE ? OR p.description LIKE ?
        OR p.barcode_short_name LIKE ? OR c.name LIKE ?
        OR EXISTS (SELECT 1 FROM product_barcodes pb WHERE pb.product_id = p.id AND pb.barcode LIKE ?)
        OR EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.sku LIKE ?)
      )`;
      params.push(term, term, term, term, term, term, term);
    }

    // Sorting
    switch (sort) {
      case 'price-low':
        sql += ` ORDER BY p.price ASC`;
        break;
      case 'price-high':
        sql += ` ORDER BY p.price DESC`;
        break;
      case 'rating':
        sql += ` ORDER BY p.rating DESC`;
        break;
      case 'newest':
        sql += ` ORDER BY p.created_at DESC`;
        break;
      default:
        sql += ` ORDER BY p.is_featured DESC, p.created_at DESC`;
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), offset);

    const products = await query(sql, params);

    // Fetch primary images and images for each product
    for (const prod of products) {
      const images = await query(
        `SELECT id, image_url, color_name, is_primary, display_order FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, display_order ASC, id ASC`,
        [prod.id]
      );
      prod.images = images.map(img => img.image_url);
      prod.primary_image = images.length > 0 ? images[0].image_url : null;
      prod.images_detailed = images;

      const variants = await query(
        `SELECT pv.id, pv.color_name, pv.color_hex, pv.size_name, pv.stock_quantity, pv.sku, pv.image_url,
                (SELECT barcode FROM product_barcodes WHERE variant_id = pv.id AND status = 'active' LIMIT 1) AS barcode
         FROM product_variants pv
         WHERE pv.product_id = ?`,
        [prod.id]
      );
      prod.variants = variants;

      // Fallback primary_image from variants if product_images has no rows
      if (!prod.primary_image && variants.length > 0) {
        const vWithImg = variants.find(v => v.image_url && v.image_url.trim());
        if (vWithImg) {
          prod.primary_image = vWithImg.image_url.trim();
          prod.images = [prod.primary_image];
        }
      }

      // Default brand image for products without any uploaded image
      if (!prod.primary_image) {
        prod.primary_image = DEFAULT_PRODUCT_IMAGE;
        if (prod.images.length === 0) {
          prod.images = [DEFAULT_PRODUCT_IMAGE];
        }
      }

      // Group colors for swatches
      const colorsMap = {};
      variants.forEach((v, vIdx) => {
        const cName = v.color_name || 'Standard';
        if (!colorsMap[cName]) {
          const matchedImg = images.find(img => img.color_name && img.color_name.trim().toLowerCase() === cName.trim().toLowerCase());
          const galleryFallback = images[vIdx] ? images[vIdx].image_url : (prod.primary_image || null);
          const resolvedImg = v.image_url || (matchedImg ? matchedImg.image_url : galleryFallback);
          colorsMap[cName] = {
            name: cName,
            hex: v.color_hex || '#000000',
            img: resolvedImg,
            image_url: resolvedImg,
            stock_quantity: v.stock_quantity !== undefined ? v.stock_quantity : 50
          };
        }
      });
      prod.colors = Object.values(colorsMap);

      // Unique sizes (filter out empty and generic fallback labels)
      prod.sizes = [...new Set(variants.map(v => (v.size_name ? v.size_name.trim() : '')).filter(s => s && s.toLowerCase() !== 'standard' && s.toLowerCase() !== 'one size'))];

      // Format features if string
      if (typeof prod.features === 'string') {
        try {
          prod.features = JSON.parse(prod.features);
        } catch (e) {
          prod.features = [];
        }
      }

      // If branch context is provided, override stock with branch_stock
      if (branch_id) {
        prod.warehouse_stock = prod.stock;
        prod.stock = prod.branch_stock !== undefined ? prod.branch_stock : 0;
        if (prod.branch_low_stock_threshold) {
          prod.low_stock_threshold = prod.branch_low_stock_threshold;
        }
      }
    }

    // Get total count matching active filters
    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const countResult = await query(countSql, params);
    const total = countResult[0] ? countResult[0].total : products.length;

    return sendSuccess(res, {
      products,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10))
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getProductByIdentifier(req, res, next, { includeOffline = false } = {}) {
  try {
    const { identifier } = req.params;
    const onlineFilter = includeOffline ? '' : ' AND (p.is_online = TRUE OR p.is_online IS NULL)';

    const rows = await query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE (p.id = ? OR p.slug = ?) AND p.is_active = TRUE${onlineFilter}`,
      [identifier, identifier]
    );

    if (!rows || rows.length === 0) {
      return sendError(res, 'Product not found', 404);
    }

    const product = rows[0];

    // Images
    const images = await query(
      `SELECT id, image_url, color_name, is_primary, display_order
       FROM product_images
       WHERE product_id = ?
       ORDER BY is_primary DESC, display_order ASC`,
      [product.id]
    );
    product.gallery = images.map(i => i.image_url);
    product.primary_image = images.length > 0 ? images[0].image_url : null;
    product.images_detailed = images;

    // Variants
    const variants = await query(
      `SELECT id, color_name, color_hex, size_name, stock_quantity, sku, image_url
       FROM product_variants
       WHERE product_id = ?`,
      [product.id]
    );
    product.variants = variants;

    // Fallback primary_image from variants if product_images has no rows
    if (!product.primary_image && variants.length > 0) {
      const vWithImg = variants.find(v => v.image_url && v.image_url.trim());
      if (vWithImg) {
        product.primary_image = vWithImg.image_url.trim();
        if (product.gallery.length === 0) {
          product.gallery = [product.primary_image];
        }
      }
    }

    // Colors mapping
    const colorsMap = {};
    variants.forEach((v, vIdx) => {
      const cName = v.color_name || 'Standard';
      if (!colorsMap[cName]) {
        const matchedImg = images.find(img => img.color_name && img.color_name.trim().toLowerCase() === cName.trim().toLowerCase());
        const galleryFallback = images[vIdx] ? images[vIdx].image_url : (product.primary_image || null);
        const resolvedImg = v.image_url || (matchedImg ? matchedImg.image_url : galleryFallback);
        colorsMap[cName] = {
          name: cName,
          hex: v.color_hex || '#000000',
          img: resolvedImg,
          image_url: resolvedImg,
          stock_quantity: v.stock_quantity !== undefined ? v.stock_quantity : 50
        };
      }
    });
    product.colors = Object.values(colorsMap);
    // Unique sizes (filter out empty and generic fallback labels)
    product.sizes = [...new Set(variants.map(v => (v.size_name ? v.size_name.trim() : '')).filter(s => s && s.toLowerCase() !== 'standard' && s.toLowerCase() !== 'one size'))];

    // Merge gallery with variant images to guarantee all color images are in gallery
    const gallerySet = new Set(images.map(i => i.image_url));
    variants.forEach(v => {
      if (v.image_url) gallerySet.add(v.image_url);
    });
    product.gallery = Array.from(gallerySet);
    if (!product.primary_image && product.gallery.length > 0) {
      product.primary_image = product.gallery[0];
    }
    if (!product.primary_image) {
      product.primary_image = DEFAULT_PRODUCT_IMAGE;
      product.gallery = [DEFAULT_PRODUCT_IMAGE];
    }

    // Reviews
    const reviews = await query(
      `SELECT id, user_name, rating, title, comment, date_label, created_at
       FROM product_reviews
       WHERE product_id = ?
       ORDER BY created_at DESC`,
      [product.id]
    );
    product.reviews = reviews;

    // Parse features JSON
    if (typeof product.features === 'string') {
      try {
        product.features = JSON.parse(product.features);
      } catch (e) {
        product.features = [];
      }
    }

    // Related products (from same category)
    const related = await query(
      `SELECT id, slug, name, price, sale_price, badge, rating
       FROM products
       WHERE category_id = ? AND id != ? AND is_active = TRUE
       LIMIT 4`,
      [product.category_id, product.id]
    );

    for (const rel of related) {
      const relImgs = await query(
        `SELECT image_url FROM product_images WHERE product_id = ? ORDER BY is_primary DESC LIMIT 1`,
        [rel.id]
      );
      rel.image = relImgs.length > 0 ? relImgs[0].image_url : DEFAULT_PRODUCT_IMAGE;
    }
    product.related_products = related;

    // Attach allocated branch stocks
    try {
      const branchStocks = await query(
        `SELECT bs.*, b.name AS branch_name, b.code AS branch_code
         FROM branch_stocks bs
         JOIN branches b ON bs.branch_id = b.id
         WHERE bs.product_id = ?`,
        [product.id]
      );
      product.branch_stocks = branchStocks;
    } catch (_) {
      product.branch_stocks = [];
    }

    return sendSuccess(res, product);
  } catch (error) {
    next(error);
  }
}

async function getProductBySlugOrId(req, res, next) {
  return getProductByIdentifier(req, res, next, { includeOffline: false });
}

async function getProductByIdAdmin(req, res, next) {
  return getProductByIdentifier(req, res, next, { includeOffline: true });
}

// Admin: Create product
async function createProduct(req, res, next) {
  try {
    const {
      name,
      slug: customSlug,
      category_id,
      gender,
      price,
      sale_price,
      badge,
      tagline,
      description,
      features,
      materials,
      care_instructions,
      dimensions,
      dimension_w,
      dimension_h,
      dimension_l,
      shipping_info,
      manufacturing_date,
      expiry_date,
      seo_title,
      seo_description,
      seo_keywords,
      is_featured,
      is_new_arrival,
      is_best_selling,
      is_active,
      is_online,
      vendor_id,
      mrp,
      purchase_price,
      purchased_rate,
      gst_type,
      gst_rate,
      landing_cost,
      purchase_margin,
      landing_margin,
      variants
    } = req.body;

    if (!name || !price) {
      return sendError(res, 'Product name and price are required.', 400);
    }

    let slug = customSlug
      ? slugify(customSlug, { lower: true, strict: true })
      : slugify(name, { lower: true, strict: true });

    // Check slug collision
    const existingSlug = await query(`SELECT id FROM products WHERE slug = ?`, [slug]);
    if (existingSlug.length > 0) {
      slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    const id = slug;

    // Determine gender (explicit or inherited from category)
    let genderVal = gender || 'none';
    if ((!gender || gender === 'all') && category_id) {
      const catRow = await query(`SELECT gender FROM categories WHERE id = ?`, [category_id]);
      if (catRow.length > 0 && catRow[0].gender) {
        genderVal = catRow[0].gender;
      }
    }

    // Build dimensions text fallback if separate dimensions provided
    let finalDimensions = dimensions;
    const w = dimension_w ? parseFloat(dimension_w) : null;
    const h = dimension_h ? parseFloat(dimension_h) : null;
    const l = dimension_l ? parseFloat(dimension_l) : null;
    if (!finalDimensions && (w || h || l)) {
      finalDimensions = `W: ${w || 0}cm × H: ${h || 0}cm × L: ${l || 0}cm`;
    }

    const isNewArrivalVal = (is_new_arrival === true || is_new_arrival === 'true' || is_new_arrival === '1' || is_new_arrival === 1) ? 1 : 0;
    const isBestSellingVal = (is_best_selling === true || is_best_selling === 'true' || is_best_selling === '1' || is_best_selling === 1) ? 1 : 0;
    const isFeaturedVal = (is_featured === true || is_featured === 'true' || is_featured === '1' || is_featured === 1) ? 1 : 0;
    const isActiveVal = (is_active === false || is_active === 'false' || is_active === '0' || is_active === 0) ? 0 : 1;
    const isOnlineVal = (is_online === false || is_online === 'false' || is_online === '0' || is_online === 0) ? 0 : 1;

    const costing = calculateProductCosting({
      purchasePrice: purchase_price,
      mrp,
      price,
      salePrice: sale_price,
      gstType: gst_type,
      gstRate: gst_rate,
      landingCost: landing_cost,
      purchaseMargin: purchase_margin,
      landingMargin: landing_margin
    });

    await query(
      `INSERT INTO products (
         id, slug, name, category_id, gender, price, sale_price, badge, tagline,
         description, features, materials, care_instructions, dimensions, dimension_w, dimension_h, dimension_l,
         shipping_info, manufacturing_date, expiry_date, seo_title, seo_description, seo_keywords,
         is_featured, is_new_arrival, is_best_selling, is_active, is_online,
         vendor_id, mrp, purchase_price, purchased_rate, gst_type, gst_rate, landing_cost, purchase_margin, landing_margin
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        slug,
        name,
        category_id || null,
        genderVal,
        parseFloat(price),
        sale_price ? parseFloat(sale_price) : 0,
        badge || null,
        tagline || null,
        description || null,
        typeof features === 'string' ? features : JSON.stringify(features || []),
        materials || null,
        care_instructions || null,
        finalDimensions || null,
        w,
        h,
        l,
        shipping_info || null,
        manufacturing_date || null,
        expiry_date || null,
        seo_title || null,
        seo_description || null,
        seo_keywords || null,
        isFeaturedVal,
        isNewArrivalVal,
        isBestSellingVal,
        isActiveVal,
        isOnlineVal,
        vendor_id ? parseInt(vendor_id, 10) : null,
        mrp ? parseFloat(mrp) : null,
        purchase_price ? parseFloat(purchase_price) : null,
        purchased_rate !== undefined && purchased_rate !== null && String(purchased_rate).trim() !== '' ? String(purchased_rate).trim() : null,
        normalizeGstType(gst_type),
        gst_rate ? parseFloat(gst_rate) : 18.00,
        costing.landingCost,
        costing.purchaseMargin,
        costing.landingMargin
      ]
    );

    if (normalizePurchaseRate(purchased_rate) !== null) {
      await recordPurchaseRateHistory(id, null, purchased_rate, req.user?.id || null);
    }

    // Save uploaded images if any (streaming to R2 if configured, storing public URL in DB)
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const imageUrl = await processUploadedFile(file, 'products');
        await query(
          `INSERT INTO product_images (product_id, image_url, is_primary, display_order)
           VALUES (?, ?, ?, ?)`,
          [id, imageUrl, i === 0 ? 1 : 0, i]
        );
      }
    }

    // Parse and save variants (with color, hex, stock_quantity, and image_url)
    let parsedVariants = [];
    if (variants) {
      try {
        parsedVariants = typeof variants === 'string' ? JSON.parse(variants) : variants;
      } catch (e) {
        parsedVariants = [];
      }
    }

    for (const v of parsedVariants) {
      await query(
        `INSERT INTO product_variants (product_id, color_name, color_hex, size_name, stock_quantity, sku, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          v.color_name || 'Standard',
          v.color_hex || '#000000',
          (v.size_name && v.size_name.trim() && v.size_name.trim().toLowerCase() !== 'standard' && v.size_name.trim().toLowerCase() !== 'one size') ? v.size_name.trim() : null,
          v.stock_quantity !== undefined && v.stock_quantity !== null ? parseInt(v.stock_quantity, 10) : 50,
          v.sku || null,
          v.image_url || null
        ]
      );

      // If variant has an image_url, ensure it is also linked in product_images with color_name
      if (v.image_url && v.image_url.trim()) {
        const cleanUrl = v.image_url.trim();
        const existingImg = await query(`SELECT id FROM product_images WHERE product_id = ? AND image_url = ?`, [id, cleanUrl]);
        if (existingImg.length === 0) {
          const maxOrder = await query(`SELECT MAX(display_order) AS max_order FROM product_images WHERE product_id = ?`, [id]);
          const nextOrder = ((maxOrder[0]?.max_order !== null && maxOrder[0]?.max_order !== undefined) ? maxOrder[0].max_order : -1) + 1;
          await query(
            `INSERT INTO product_images (product_id, image_url, color_name, is_primary, display_order)
             VALUES (?, ?, ?, 0, ?)`,
            [id, cleanUrl, v.color_name || null, nextOrder]
          );
        } else {
          await query(
            `UPDATE product_images SET color_name = COALESCE(?, color_name) WHERE id = ?`,
            [v.color_name || null, existingImg[0].id]
          );
        }
      }
    }

    // Save initial branch stock allocation & visibility if provided
    if (req.body.branch_id) {
      try {
        const bId = parseInt(req.body.branch_id, 10);
        const bStock = req.body.branch_stock !== undefined && req.body.branch_stock !== ''
          ? parseInt(req.body.branch_stock, 10)
          : 0;
        const bActive = req.body.is_branch_active !== undefined
          ? (req.body.is_branch_active === '1' || req.body.is_branch_active === 1 || req.body.is_branch_active === true || req.body.is_branch_active === 'true' ? 1 : 0)
          : 0;

        await query(
          `INSERT INTO branch_stocks (branch_id, product_id, stock, low_stock_threshold, is_active)
           VALUES (?, ?, ?, 5, ?)
           ON DUPLICATE KEY UPDATE
             stock = VALUES(stock),
             is_active = VALUES(is_active),
             updated_at = CURRENT_TIMESTAMP`,
          [bId, id, bStock, bActive]
        );
      } catch (bErr) {
        console.warn('[Product Create] Error saving initial branch stock:', bErr.message);
      }
    }

    // Log creation in audit logs
    try {
      const { recordAuditLog } = require('./auditLogController');
      const primaryImg = await query('SELECT image_url FROM product_images WHERE product_id = ? AND is_primary = TRUE LIMIT 1', [id]);
      await recordAuditLog({
        entity_type: 'product',
        entity_id: id,
        action: 'product_create',
        summary: `Created product "${name}" (Price: ₹${price}, MRP: ₹${mrp || price})`,
        product_id: id,
        product_name: name,
        product_image: primaryImg[0]?.image_url || null,
        new_values: req.body
      });
    } catch (e) {
      console.error('Audit log error on createProduct:', e);
    }

    return sendSuccess(res, { id, slug }, 'Product created successfully', 201);
  } catch (error) {
    next(error);
  }
}

// Admin: Update product
async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;

    // Fetch existing product state before update for audit trail
    const existingRows = await query('SELECT * FROM products WHERE id = ?', [id]);
    const oldProd = existingRows[0] || null;

    const {
      name,
      slug: newSlug,
      category_id,
      gender,
      price,
      sale_price,
      badge,
      tagline,
      description,
      features,
      materials,
      care_instructions,
      dimensions,
      dimension_w,
      dimension_h,
      dimension_l,
      shipping_info,
      manufacturing_date,
      expiry_date,
      seo_title,
      seo_description,
      seo_keywords,
      is_featured,
      is_new_arrival,
      is_best_selling,
      is_active,
      is_online,
      vendor_id,
      mrp,
      purchase_price,
      purchased_rate,
      gst_type,
      gst_rate,
      landing_cost,
      purchase_margin,
      landing_margin,
      variants
    } = req.body;

    // If slug is changed, check uniqueness
    if (newSlug) {
      const cleanSlug = slugify(newSlug, { lower: true, strict: true });
      const duplicateSlug = await query(`SELECT id FROM products WHERE slug = ? AND id != ?`, [cleanSlug, id]);
      if (duplicateSlug.length > 0) {
        return sendError(res, `Slug "${cleanSlug}" is already taken by another product.`, 400);
      }
      await query(`UPDATE products SET slug = ? WHERE id = ?`, [cleanSlug, id]);
    }

    const w = dimension_w !== undefined && dimension_w !== '' ? parseFloat(dimension_w) : null;
    const h = dimension_h !== undefined && dimension_h !== '' ? parseFloat(dimension_h) : null;
    const l = dimension_l !== undefined && dimension_l !== '' ? parseFloat(dimension_l) : null;

    let finalDimensions = dimensions;
    if (!finalDimensions && (w || h || l)) {
      finalDimensions = `W: ${w || 0}cm × H: ${h || 0}cm × L: ${l || 0}cm`;
    }

    const isNewArrivalVal = is_new_arrival !== undefined ? ((is_new_arrival === true || is_new_arrival === 'true' || is_new_arrival === '1' || is_new_arrival === 1) ? 1 : 0) : null;
    const isBestSellingVal = is_best_selling !== undefined ? ((is_best_selling === true || is_best_selling === 'true' || is_best_selling === '1' || is_best_selling === 1) ? 1 : 0) : null;
    const isFeaturedVal = is_featured !== undefined ? ((is_featured === true || is_featured === 'true' || is_featured === '1' || is_featured === 1) ? 1 : 0) : null;
    const isActiveVal = is_active !== undefined ? ((is_active === true || is_active === 'true' || is_active === '1' || is_active === 1) ? 1 : 0) : null;
    const isOnlineVal = is_online !== undefined ? ((is_online === true || is_online === 'true' || is_online === '1' || is_online === 1) ? 1 : 0) : null;

    const gstTypeVal = gst_type !== undefined ? normalizeGstType(gst_type) : null;

    const resolvedPurchasePrice = purchase_price !== undefined ? purchase_price : (oldProd ? oldProd.purchase_price : null);
    const resolvedMrp = mrp !== undefined ? mrp : (oldProd ? oldProd.mrp : null);
    const resolvedPrice = price !== undefined ? price : (oldProd ? oldProd.price : null);
    const resolvedSalePrice = sale_price !== undefined ? sale_price : (oldProd ? oldProd.sale_price : null);
    const resolvedGstType = gst_type !== undefined ? gst_type : (oldProd ? oldProd.gst_type : 'exclusive');
    const resolvedGstRate = gst_rate !== undefined ? gst_rate : (oldProd ? oldProd.gst_rate : 18);

    const costing = calculateProductCosting({
      purchasePrice: resolvedPurchasePrice,
      mrp: resolvedMrp,
      price: resolvedPrice,
      salePrice: resolvedSalePrice,
      gstType: resolvedGstType,
      gstRate: resolvedGstRate,
      landingCost: landing_cost,
      purchaseMargin: purchase_margin,
      landingMargin: landing_margin
    });

    const shouldUpdateCosting = purchase_price !== undefined || mrp !== undefined || price !== undefined ||
      sale_price !== undefined || gst_type !== undefined || gst_rate !== undefined ||
      landing_cost !== undefined || purchase_margin !== undefined || landing_margin !== undefined;

    await query(
      `UPDATE products SET
         name = COALESCE(?, name),
         category_id = COALESCE(?, category_id),
         price = COALESCE(?, price),
         sale_price = COALESCE(?, sale_price),
         badge = ?,
         tagline = COALESCE(?, tagline),
         description = COALESCE(?, description),
         features = COALESCE(?, features),
         materials = IF(? IS NOT NULL, ?, materials),
         care_instructions = IF(? IS NOT NULL, ?, care_instructions),
         dimensions = COALESCE(?, dimensions),
         dimension_w = COALESCE(?, dimension_w),
         dimension_h = COALESCE(?, dimension_h),
         dimension_l = COALESCE(?, dimension_l),
         shipping_info = IF(? IS NOT NULL, ?, shipping_info),
         manufacturing_date = IF(? IS NOT NULL, ?, manufacturing_date),
         expiry_date = IF(? IS NOT NULL, ?, expiry_date),
         seo_title = IF(? IS NOT NULL, ?, seo_title),
         seo_description = IF(? IS NOT NULL, ?, seo_description),
         seo_keywords = IF(? IS NOT NULL, ?, seo_keywords),
         is_featured = COALESCE(?, is_featured),
         is_new_arrival = COALESCE(?, is_new_arrival),
         is_best_selling = COALESCE(?, is_best_selling),
         is_active = IF(? IS NOT NULL, ?, is_active),
         is_online = IF(? IS NOT NULL, ?, is_online),
         vendor_id = IF(? IS NOT NULL, ?, vendor_id),
         mrp = IF(? IS NOT NULL, ?, mrp),
         purchase_price = IF(? IS NOT NULL, ?, purchase_price),
         purchased_rate = IF(? IS NOT NULL, ?, purchased_rate),
         gst_type = IF(? IS NOT NULL, ?, gst_type),
         gst_rate = IF(? IS NOT NULL, ?, gst_rate),
         landing_cost = IF(? IS NOT NULL, ?, landing_cost),
         purchase_margin = IF(? IS NOT NULL, ?, purchase_margin),
         landing_margin = IF(? IS NOT NULL, ?, landing_margin)
       WHERE id = ?`,
      [
        name || null,
        category_id || null,
        price ? parseFloat(price) : null,
        sale_price !== undefined ? parseFloat(sale_price) : null,
        badge !== undefined ? badge : null,
        tagline || null,
        description || null,
        features ? (typeof features === 'string' ? features : JSON.stringify(features)) : null,
        materials !== undefined ? materials : null,
        materials !== undefined ? materials : null,
        care_instructions !== undefined ? care_instructions : null,
        care_instructions !== undefined ? care_instructions : null,
        finalDimensions || null,
        w,
        h,
        l,
        shipping_info !== undefined ? shipping_info : null,
        shipping_info !== undefined ? shipping_info : null,
        manufacturing_date !== undefined ? (manufacturing_date || null) : null,
        manufacturing_date !== undefined ? (manufacturing_date || null) : null,
        expiry_date !== undefined ? (expiry_date || null) : null,
        expiry_date !== undefined ? (expiry_date || null) : null,
        seo_title !== undefined ? seo_title : null,
        seo_title !== undefined ? seo_title : null,
        seo_description !== undefined ? seo_description : null,
        seo_description !== undefined ? seo_description : null,
        seo_keywords !== undefined ? seo_keywords : null,
        seo_keywords !== undefined ? seo_keywords : null,
        isFeaturedVal,
        isNewArrivalVal,
        isBestSellingVal,
        isActiveVal !== null ? isActiveVal : null,
        isActiveVal !== null ? isActiveVal : null,
        isOnlineVal !== null ? isOnlineVal : null,
        isOnlineVal !== null ? isOnlineVal : null,
        vendor_id !== undefined ? (vendor_id ? parseInt(vendor_id, 10) : null) : null,
        vendor_id !== undefined ? (vendor_id ? parseInt(vendor_id, 10) : null) : null,
        mrp !== undefined ? (mrp ? parseFloat(mrp) : null) : null,
        mrp !== undefined ? (mrp ? parseFloat(mrp) : null) : null,
        purchase_price !== undefined ? (purchase_price ? parseFloat(purchase_price) : null) : null,
        purchase_price !== undefined ? (purchase_price ? parseFloat(purchase_price) : null) : null,
        purchased_rate !== undefined ? 1 : null,
        purchased_rate !== undefined ? (String(purchased_rate).trim() !== '' ? String(purchased_rate).trim() : null) : null,
        gstTypeVal,
        gstTypeVal,
        gst_rate !== undefined ? parseFloat(gst_rate) : null,
        gst_rate !== undefined ? parseFloat(gst_rate) : null,
        shouldUpdateCosting ? 1 : null,
        costing.landingCost,
        shouldUpdateCosting ? 1 : null,
        costing.purchaseMargin,
        shouldUpdateCosting ? 1 : null,
        costing.landingMargin,
        id
      ]
    );

    if (purchased_rate !== undefined) {
      await recordPurchaseRateHistory(
        id,
        oldProd ? oldProd.purchased_rate : null,
        purchased_rate,
        req.user?.id || null
      );
    }

    if (gender !== undefined) {
      await query(`UPDATE products SET gender = ? WHERE id = ?`, [gender || 'none', id]);
    }

    // If new files uploaded
    if (req.files && req.files.length > 0) {
      // Demote existing primary images so newly uploaded cover image takes priority
      await query(`UPDATE product_images SET is_primary = 0 WHERE product_id = ?`, [id]);
      await query(`UPDATE product_images SET display_order = display_order + ? WHERE product_id = ?`, [req.files.length, id]);

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const imageUrl = await processUploadedFile(file, 'products');
        await query(
          `INSERT INTO product_images (product_id, image_url, is_primary, display_order)
           VALUES (?, ?, ?, ?)`,
          [id, imageUrl, i === 0 ? 1 : 0, i]
        );
      }
    }

    // Ensure at least one image is primary if images exist
    const checkPrimary = await query(`SELECT id FROM product_images WHERE product_id = ? AND is_primary = 1`, [id]);
    if (checkPrimary.length === 0) {
      const firstImg = await query(`SELECT id FROM product_images WHERE product_id = ? ORDER BY display_order ASC, id ASC LIMIT 1`, [id]);
      if (firstImg.length > 0) {
        await query(`UPDATE product_images SET is_primary = 1 WHERE id = ?`, [firstImg[0].id]);
      }
    }

    // Update variants if provided
    if (variants !== undefined) {
      let parsedVariants = [];
      try {
        parsedVariants = typeof variants === 'string' ? JSON.parse(variants) : variants;
      } catch (e) {
        parsedVariants = [];
      }
      if (Array.isArray(parsedVariants)) {
        await query(`DELETE FROM product_variants WHERE product_id = ?`, [id]);
        for (const v of parsedVariants) {
          await query(
            `INSERT INTO product_variants (product_id, color_name, color_hex, size_name, stock_quantity, sku, image_url)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              v.color_name || 'Standard',
              v.color_hex || '#000000',
              (v.size_name && v.size_name.trim() && v.size_name.trim().toLowerCase() !== 'standard' && v.size_name.trim().toLowerCase() !== 'one size') ? v.size_name.trim() : null,
              v.stock_quantity !== undefined && v.stock_quantity !== null ? parseInt(v.stock_quantity, 10) : 50,
              v.sku || null,
              v.image_url || null
            ]
          );

          // If variant has an image_url, ensure it is also linked in product_images with color_name
          if (v.image_url && v.image_url.trim()) {
            const cleanUrl = v.image_url.trim();
            const existingImg = await query(`SELECT id FROM product_images WHERE product_id = ? AND image_url = ?`, [id, cleanUrl]);
            if (existingImg.length === 0) {
              const maxOrder = await query(`SELECT MAX(display_order) AS max_order FROM product_images WHERE product_id = ?`, [id]);
              const nextOrder = ((maxOrder[0]?.max_order !== null && maxOrder[0]?.max_order !== undefined) ? maxOrder[0].max_order : -1) + 1;
              await query(
                `INSERT INTO product_images (product_id, image_url, color_name, is_primary, display_order)
                 VALUES (?, ?, ?, 0, ?)`,
                [id, cleanUrl, v.color_name || null, nextOrder]
              );
            } else {
              await query(
                `UPDATE product_images SET color_name = COALESCE(?, color_name) WHERE id = ?`,
                [v.color_name || null, existingImg[0].id]
              );
            }
          }
        }
      }
    }

    // Save or update branch stock allocation & visibility if provided
    if (req.body.branch_id) {
      try {
        const bId = parseInt(req.body.branch_id, 10);
        const bStock = req.body.branch_stock !== undefined && req.body.branch_stock !== ''
          ? parseInt(req.body.branch_stock, 10)
          : null;
        const bActive = req.body.is_branch_active !== undefined
          ? (req.body.is_branch_active === '1' || req.body.is_branch_active === 1 || req.body.is_branch_active === true || req.body.is_branch_active === 'true' ? 1 : 0)
          : null;

        await query(
          `INSERT INTO branch_stocks (branch_id, product_id, stock, low_stock_threshold, is_active)
           VALUES (?, ?, COALESCE(?, 0), 5, COALESCE(?, 1))
           ON DUPLICATE KEY UPDATE
             stock = COALESCE(?, stock),
             is_active = COALESCE(?, is_active),
             updated_at = CURRENT_TIMESTAMP`,
          [bId, id, bStock, bActive, bStock, bActive]
        );
      } catch (bErr) {
        console.warn('[Product Update] Error updating branch stock:', bErr.message);
      }
    }

    // Record audit log for update / price changes
    try {
      const { recordAuditLog } = require('./auditLogController');
      const isPriceChanged = price && oldProd && parseFloat(price) !== parseFloat(oldProd.price);
      const isStockChanged = req.body.stock !== undefined && oldProd && parseInt(req.body.stock, 10) !== parseInt(oldProd.stock, 10);
      const primaryImg = await query('SELECT image_url FROM product_images WHERE product_id = ? AND is_primary = TRUE LIMIT 1', [id]);

      let action = 'product_update';
      let summary = `Updated product "${name || oldProd?.name || id}"`;

      if (isPriceChanged) {
        action = 'price_change';
        summary = `Price changed from ₹${oldProd.price} to ₹${price} for "${name || oldProd.name}"`;
      } else if (isStockChanged) {
        action = 'stock_adjust';
        summary = `Stock adjusted from ${oldProd.stock || 0} to ${req.body.stock} units for "${name || oldProd.name}"`;
      }

      await recordAuditLog({
        entity_type: 'product',
        entity_id: id,
        action,
        summary,
        old_values: oldProd,
        new_values: req.body,
        product_id: id,
        product_name: name || oldProd?.name,
        product_image: primaryImg[0]?.image_url || null
      });
    } catch (e) {
      console.error('Audit log error on updateProduct:', e);
    }

    return sendSuccess(res, { id }, 'Product updated successfully');
  } catch (error) {
    next(error);
  }
}

// Admin: Duplicate product
async function duplicateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await query(`SELECT * FROM products WHERE id = ?`, [id]);
    if (!existing || existing.length === 0) {
      return sendError(res, 'Product not found', 404);
    }

    const orig = existing[0];
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newSlug = `${orig.slug}-copy-${randomSuffix}`;
    const newId = newSlug;
    const newName = `${orig.name} (Copy)`;

    await query(
      `INSERT INTO products (
         id, slug, name, category_id, price, sale_price, badge, tagline,
         description, features, materials, dimensions, dimension_w, dimension_h, dimension_l,
         shipping_info, is_featured, is_active, is_online
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)`,
      [
        newId,
        newSlug,
        newName,
        orig.category_id,
        orig.price,
        orig.sale_price,
        orig.badge,
        orig.tagline,
        orig.description,
        orig.features,
        orig.materials,
        orig.dimensions,
        orig.dimension_w,
        orig.dimension_h,
        orig.dimension_l,
        orig.shipping_info,
        orig.is_featured,
        orig.is_online !== undefined && orig.is_online !== null ? (orig.is_online ? 1 : 0) : 1
      ]
    );

    // Clone images
    const images = await query(`SELECT * FROM product_images WHERE product_id = ?`, [id]);
    for (const img of images) {
      await query(
        `INSERT INTO product_images (product_id, image_url, color_name, is_primary, display_order)
         VALUES (?, ?, ?, ?, ?)`,
        [newId, img.image_url, img.color_name, img.is_primary, img.display_order]
      );
    }

    // Clone variants
    const variants = await query(`SELECT * FROM product_variants WHERE product_id = ?`, [id]);
    for (const v of variants) {
      await query(
        `INSERT INTO product_variants (product_id, color_name, color_hex, size_name, stock_quantity, sku, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId, v.color_name, v.color_hex, v.size_name, v.stock_quantity, v.sku ? `${v.sku}-CPY` : null, v.image_url]
      );
    }

    return sendSuccess(res, { id: newId, slug: newSlug, name: newName }, 'Product duplicated successfully', 201);
  } catch (error) {
    next(error);
  }
}

// Admin: Delete single product image
async function deleteProductImage(req, res, next) {
  try {
    const { id: productId, imageId } = req.params;
    const imgs = await query(`SELECT * FROM product_images WHERE id = ? AND product_id = ?`, [imageId, productId]);
    if (imgs.length === 0) {
      return sendError(res, 'Image not found', 404);
    }

    const img = imgs[0];
    await deleteUploadedFile(img.image_url);
    await query(`DELETE FROM product_images WHERE id = ?`, [imageId]);

    // Also clear this image URL from any variants that were using it
    if (img.image_url) {
      await query(`UPDATE product_variants SET image_url = NULL WHERE product_id = ? AND image_url = ?`, [productId, img.image_url]);
    }

    // If it was primary, promote another image to primary
    if (img.is_primary) {
      const remaining = await query(`SELECT id FROM product_images WHERE product_id = ? ORDER BY display_order ASC LIMIT 1`, [productId]);
      if (remaining.length > 0) {
        await query(`UPDATE product_images SET is_primary = 1 WHERE id = ?`, [remaining[0].id]);
      }
    }

    return sendSuccess(res, null, 'Image deleted successfully');
  } catch (error) {
    next(error);
  }
}

// Admin: Replace single product image
async function replaceProductImage(req, res, next) {
  try {
    const { id: productId, imageId } = req.params;
    const imgs = await query(`SELECT * FROM product_images WHERE id = ? AND product_id = ?`, [imageId, productId]);
    if (imgs.length === 0) {
      return sendError(res, 'Image not found', 404);
    }

    let newUrl = req.body.image_url;
    if (req.file) {
      newUrl = await processUploadedFile(req.file, 'products');
    }

    if (!newUrl) {
      return sendError(res, 'No image file or URL provided', 400);
    }

    const oldImg = imgs[0];
    await deleteUploadedFile(oldImg.image_url);

    await query(`UPDATE product_images SET image_url = ? WHERE id = ?`, [newUrl, imageId]);
    return sendSuccess(res, { image_url: newUrl }, 'Image replaced successfully');
  } catch (error) {
    next(error);
  }
}

// Admin: Set primary image
async function setPrimaryProductImage(req, res, next) {
  try {
    const { id: productId, imageId } = req.params;
    const target = await query(`SELECT * FROM product_images WHERE id = ? AND product_id = ?`, [imageId, productId]);
    if (target.length === 0) {
      return sendError(res, 'Image not found for this product', 404);
    }

    await query(`UPDATE product_images SET is_primary = 0 WHERE product_id = ?`, [productId]);
    await query(`UPDATE product_images SET is_primary = 1, display_order = 0 WHERE id = ? AND product_id = ?`, [imageId, productId]);
    await query(`UPDATE product_images SET display_order = display_order + 1 WHERE product_id = ? AND id != ?`, [productId, imageId]);

    return sendSuccess(res, { primary_image: target[0].image_url }, 'Primary image updated successfully');
  } catch (error) {
    next(error);
  }
}

// Admin: Upload new image directly to product gallery
async function uploadProductGalleryImage(req, res, next) {
  try {
    const { id: productId } = req.params;
    if (!req.file) {
      return sendError(res, 'No image file provided', 400);
    }

    const imageUrl = await processUploadedFile(req.file, 'products');
    const existing = await query(`SELECT COUNT(*) AS count FROM product_images WHERE product_id = ?`, [productId]);
    const isPrimary = (existing[0]?.count || 0) === 0 ? 1 : 0;

    const result = await query(
      `INSERT INTO product_images (product_id, image_url, color_name, is_primary, display_order)
       VALUES (?, ?, ?, ?, ?)`,
      [productId, imageUrl, req.body.color_name || null, isPrimary, existing[0]?.count || 0]
    );

    return sendSuccess(res, { id: result.insertId, image_url: imageUrl }, 'Image uploaded to gallery', 201);
  } catch (error) {
    next(error);
  }
}

// Admin: Delete product
async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;

    // Get all images to delete from disk / R2
    const images = await query(`SELECT image_url FROM product_images WHERE product_id = ?`, [id]);
    images.forEach(img => deleteUploadedFile(img.image_url));

    await query(`DELETE FROM product_images WHERE product_id = ?`, [id]);
    await query(`DELETE FROM product_variants WHERE product_id = ?`, [id]);
    await query(`DELETE FROM products WHERE id = ?`, [id]);

    return sendSuccess(res, null, 'Product deleted successfully');
  } catch (error) {
    next(error);
  }
}

// Admin: Purchase rate change history for a product
async function getProductPurchaseRateHistory(req, res, next) {
  try {
    const { id } = req.params;
    const history = await query(
      `SELECT id, product_id, old_rate, new_rate, changed_by, changed_at
       FROM product_purchase_rate_history
       WHERE product_id = ?
       ORDER BY changed_at DESC, id DESC
       LIMIT 100`,
      [id]
    );
    return sendSuccess(res, history);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllProducts,
  getProductBySlugOrId,
  getProductByIdAdmin,
  getProductPurchaseRateHistory,
  createProduct,
  updateProduct,
  deleteProduct,
  duplicateProduct,
  deleteProductImage,
  replaceProductImage,
  setPrimaryProductImage,
  uploadProductGalleryImage
};

