const slugify = require('slugify');
const { query } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { processUploadedFile, deleteUploadedFile } = require('../middleware/upload');

async function getAllProducts(req, res, next) {
  try {
    const {
      category,
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
      is_best_selling
    } = req.query;

    let sql = `
      SELECT p.*, c.name AS category_name, c.slug AS category_slug, c.parent_id,
             parent.slug AS parent_category_slug, parent.name AS parent_category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories parent ON c.parent_id = parent.id
      WHERE p.is_active = TRUE
    `;
    const params = [];

    if (category && category !== 'all') {
      sql += ` AND (
        LOWER(c.slug) = LOWER(?) OR LOWER(c.name) = LOWER(?)
        OR LOWER(COALESCE(parent.slug, '')) = LOWER(?) OR LOWER(COALESCE(parent.name, '')) = LOWER(?)
      )`;
      params.push(category, category, category, category);
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
      sql += ` AND (p.name LIKE ? OR p.tagline LIKE ? OR p.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
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
        `SELECT id, color_name, color_hex, size_name, stock_quantity, sku, image_url FROM product_variants WHERE product_id = ?`,
        [prod.id]
      );
      prod.variants = variants;

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

      // Unique sizes
      prod.sizes = [...new Set(variants.map(v => v.size_name).filter(Boolean))];

      // Format features if string
      if (typeof prod.features === 'string') {
        try {
          prod.features = JSON.parse(prod.features);
        } catch (e) {
          prod.features = [];
        }
      }
    }

    // Get total count
    const countSql = `SELECT COUNT(*) AS total FROM products WHERE is_active = TRUE`;
    const countResult = await query(countSql);
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

async function getProductBySlugOrId(req, res, next) {
  try {
    const { identifier } = req.params;

    const rows = await query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE (p.id = ? OR p.slug = ?) AND p.is_active = TRUE`,
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
    product.sizes = [...new Set(variants.map(v => v.size_name).filter(Boolean))];

    // Merge gallery with variant images to guarantee all color images are in gallery
    const gallerySet = new Set(images.map(i => i.image_url));
    variants.forEach(v => {
      if (v.image_url) gallerySet.add(v.image_url);
    });
    product.gallery = Array.from(gallerySet);
    if (!product.primary_image && product.gallery.length > 0) {
      product.primary_image = product.gallery[0];
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
      rel.image = relImgs.length > 0 ? relImgs[0].image_url : null;
    }
    product.related_products = related;

    return sendSuccess(res, product);
  } catch (error) {
    next(error);
  }
}

// Admin: Create product
async function createProduct(req, res, next) {
  try {
    const {
      name,
      slug: customSlug,
      category_id,
      price,
      sale_price,
      badge,
      tagline,
      description,
      features,
      materials,
      dimensions,
      dimension_w,
      dimension_h,
      dimension_l,
      shipping_info,
      is_featured,
      is_new_arrival,
      is_best_selling,
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

    await query(
      `INSERT INTO products (
         id, slug, name, category_id, price, sale_price, badge, tagline,
         description, features, materials, dimensions, dimension_w, dimension_h, dimension_l,
         shipping_info, is_featured, is_new_arrival, is_best_selling, is_active
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        id,
        slug,
        name,
        category_id || null,
        parseFloat(price),
        sale_price ? parseFloat(sale_price) : 0,
        badge || null,
        tagline || null,
        description || null,
        typeof features === 'string' ? features : JSON.stringify(features || []),
        materials || null,
        finalDimensions || null,
        w,
        h,
        l,
        shipping_info || null,
        isFeaturedVal,
        isNewArrivalVal,
        isBestSellingVal
      ]
    );

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
          v.size_name || 'Standard',
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

    return sendSuccess(res, { id, slug }, 'Product created successfully', 201);
  } catch (error) {
    next(error);
  }
}

// Admin: Update product
async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const {
      name,
      slug: newSlug,
      category_id,
      price,
      sale_price,
      badge,
      tagline,
      description,
      features,
      materials,
      dimensions,
      dimension_w,
      dimension_h,
      dimension_l,
      shipping_info,
      is_featured,
      is_new_arrival,
      is_best_selling,
      is_active,
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
         materials = COALESCE(?, materials),
         dimensions = COALESCE(?, dimensions),
         dimension_w = COALESCE(?, dimension_w),
         dimension_h = COALESCE(?, dimension_h),
         dimension_l = COALESCE(?, dimension_l),
         shipping_info = COALESCE(?, shipping_info),
         is_featured = COALESCE(?, is_featured),
         is_new_arrival = COALESCE(?, is_new_arrival),
         is_best_selling = COALESCE(?, is_best_selling),
         is_active = COALESCE(?, is_active)
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
        materials || null,
        finalDimensions || null,
        w,
        h,
        l,
        shipping_info || null,
        isFeaturedVal,
        isNewArrivalVal,
        isBestSellingVal,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        id
      ]
    );

    // If new files uploaded
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const imageUrl = await processUploadedFile(file, 'products');
        await query(
          `INSERT INTO product_images (product_id, image_url, is_primary, display_order)
           VALUES (?, ?, 0, ?)`,
          [id, imageUrl, i]
        );
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
              v.size_name || 'Standard',
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
         shipping_info, is_featured, is_active
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
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
        orig.is_featured
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

module.exports = {
  getAllProducts,
  getProductBySlugOrId,
  createProduct,
  updateProduct,
  deleteProduct,
  duplicateProduct,
  deleteProductImage,
  replaceProductImage,
  setPrimaryProductImage,
  uploadProductGalleryImage
};

