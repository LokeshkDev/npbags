const { query } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

async function createOrder(req, res, next) {
  try {
    const {
      customer_name,
      customer_email,
      customer_phone,
      shipping_address,
      items,
      payment_method = 'cod',
      coupon_code,
      notes
    } = req.body;

    if (!customer_name || !customer_email || !customer_phone || !shipping_address) {
      return sendError(res, 'Customer contact and shipping address are required.', 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return sendError(res, 'Order must contain at least one item.', 400);
    }

    // 1. Calculate subtotal
    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const prods = await query(`SELECT id, name, price, sale_price FROM products WHERE id = ?`, [item.id || item.product_id]);
      if (prods.length === 0) {
        return sendError(res, `Product not found: ${item.name || item.id}`, 400);
      }
      const prod = prods[0];
      const itemPrice = prod.sale_price > 0 ? parseFloat(prod.sale_price) : parseFloat(prod.price);
      const qty = parseInt(item.qty || item.quantity, 10) || 1;
      const itemTotal = itemPrice * qty;

      // Always query true primary image from product_images table in DB
      const imgs = await query(
        `SELECT image_url FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, display_order ASC, id ASC LIMIT 1`,
        [prod.id]
      );
      const dbPrimaryImg = imgs.length > 0 && imgs[0].image_url ? imgs[0].image_url : null;

      // Only preserve item.image if it's a real specific variant image (and not a fallback to best-handbag.png)
      let primaryImg = null;
      if (item.image && typeof item.image === 'string' && !item.image.includes('best-handbag.png') && item.image.trim() !== '') {
        primaryImg = item.image.trim();
      } else {
        primaryImg = dbPrimaryImg;
      }
      if (!primaryImg) {
        primaryImg = dbPrimaryImg || '/assets/bestsellers/best-handbag.png';
      }

      subtotal += itemTotal;
      validatedItems.push({
        product_id: prod.id,
        product_name: prod.name,
        variant_info: item.variant_info || (item.size ? `${item.color || ''} · ${item.size}` : item.color || null),
        price: itemPrice,
        quantity: qty,
        total: itemTotal,
        image_url: primaryImg
      });
    }

    // 2. Fetch delivery settings for shipping fee
    const deliveryRows = await query(`SELECT * FROM delivery_settings WHERE id = 1`);
    const delivery = deliveryRows[0] || { free_delivery_threshold: 499.00, standard_shipping_fee: 49.00 };

    let shipping_fee = subtotal >= parseFloat(delivery.free_delivery_threshold) ? 0.00 : parseFloat(delivery.standard_shipping_fee);

    // 3. Check coupon if provided
    let discount = 0.00;
    if (coupon_code) {
      const coupons = await query(
        `SELECT * FROM coupons WHERE UPPER(code) = UPPER(?) AND is_active = TRUE`,
        [coupon_code.trim()]
      );

      if (coupons.length > 0) {
        const c = coupons[0];
        if (subtotal >= parseFloat(c.min_order_amount)) {
          if (c.discount_type === 'percentage') {
            discount = (subtotal * parseFloat(c.discount_value)) / 100;
            if (c.max_discount && discount > parseFloat(c.max_discount)) {
              discount = parseFloat(c.max_discount);
            }
          } else {
            discount = parseFloat(c.discount_value);
          }
        }
      }
    }

    const total_amount = Math.max(0, subtotal - discount + shipping_fee);

    // Generate readable order number: NP-20261014-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const order_number = `NP-${dateStr}-${randomSuffix}`;

    const userId = req.user ? req.user.id : null;

    const orderResult = await query(
      `INSERT INTO orders (order_number, user_id, customer_name, customer_email, customer_phone, shipping_address, subtotal, discount, shipping_fee, total_amount, payment_method, payment_status, order_status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?)`,
      [
        order_number,
        userId,
        customer_name,
        customer_email.toLowerCase().trim(),
        customer_phone,
        typeof shipping_address === 'string' ? shipping_address : JSON.stringify(shipping_address),
        subtotal,
        discount,
        shipping_fee,
        total_amount,
        payment_method,
        notes || null
      ]
    );

    const orderId = orderResult.insertId;

    // Insert order items
    for (const vItem of validatedItems) {
      await query(
        `INSERT INTO order_items (order_id, product_id, product_name, variant_info, price, quantity, total, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, vItem.product_id, vItem.product_name, vItem.variant_info, vItem.price, vItem.quantity, vItem.total, vItem.image_url]
      );
    }

    return sendSuccess(res, {
      order_id: orderId,
      order_number,
      total_amount,
      subtotal,
      discount,
      shipping_fee
    }, 'Order placed successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function getOrderDetails(req, res, next) {
  try {
    const { identifier } = req.params;
    const orders = await query(
      `SELECT * FROM orders WHERE id = ? OR order_number = ?`,
      [identifier, identifier]
    );

    if (orders.length === 0) {
      return sendError(res, 'Order not found', 404);
    }

    const order = orders[0];
    const items = await query(
      `SELECT oi.*,
        (SELECT image_url FROM product_images WHERE product_id = oi.product_id ORDER BY is_primary DESC, display_order ASC, id ASC LIMIT 1) AS db_primary_image
       FROM order_items oi
       WHERE oi.order_id = ?`,
      [order.id]
    );
    order.items = items.map(it => {
      let finalImg = it.image_url;
      if (!finalImg || finalImg.includes('best-handbag.png')) {
        finalImg = it.db_primary_image || finalImg;
      }
      if (!finalImg) {
        finalImg = it.db_primary_image || it.image_url || '/assets/bestsellers/best-handbag.png';
      }
      return {
        ...it,
        image_url: finalImg,
        image: finalImg
      };
    });

    if (typeof order.shipping_address === 'string') {
      try {
        order.shipping_address = JSON.parse(order.shipping_address);
      } catch (e) {}
    }

    return sendSuccess(res, order);
  } catch (error) {
    next(error);
  }
}

async function getMyOrders(req, res, next) {
  try {
    const orders = await query(
      `SELECT * FROM orders WHERE user_id = ? OR LOWER(customer_email) = LOWER(?) ORDER BY created_at DESC`,
      [req.user.id, req.user.email]
    );

    for (const order of orders) {
      const items = await query(
        `SELECT oi.*,
          (SELECT image_url FROM product_images WHERE product_id = oi.product_id ORDER BY is_primary DESC, display_order ASC, id ASC LIMIT 1) AS db_primary_image
         FROM order_items oi
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items.map(it => {
        let finalImg = it.image_url;
        if (!finalImg || finalImg.includes('best-handbag.png')) {
          finalImg = it.db_primary_image || finalImg;
        }
        if (!finalImg) {
          finalImg = it.db_primary_image || it.image_url || '/assets/bestsellers/best-handbag.png';
        }
        return {
          ...it,
          image_url: finalImg,
          image: finalImg
        };
      });
      if (typeof order.shipping_address === 'string') {
        try { order.shipping_address = JSON.parse(order.shipping_address); } catch (e) {}
      }
    }

    return sendSuccess(res, orders);
  } catch (error) {
    next(error);
  }
}

async function validateCoupon(req, res, next) {
  try {
    const { code, subtotal = 0 } = req.body;
    if (!code) return sendError(res, 'Coupon code is required.', 400);

    const coupons = await query(
      `SELECT * FROM coupons WHERE UPPER(code) = UPPER(?) AND is_active = TRUE`,
      [code.trim()]
    );

    if (coupons.length === 0) {
      return sendError(res, 'Invalid or expired coupon code.', 400);
    }

    const coupon = coupons[0];
    const parsedSubtotal = parseFloat(subtotal);

    if (parsedSubtotal < parseFloat(coupon.min_order_amount)) {
      return sendError(
        res,
        `Minimum order amount of ₹${coupon.min_order_amount} required for this coupon.`,
        400
      );
    }

    let discount = 0;
    if (coupon.discount_type === 'percentage') {
      discount = (parsedSubtotal * parseFloat(coupon.discount_value)) / 100;
      if (coupon.max_discount && discount > parseFloat(coupon.max_discount)) {
        discount = parseFloat(coupon.max_discount);
      }
    } else {
      discount = parseFloat(coupon.discount_value);
    }

    return sendSuccess(res, {
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      discount_amount: discount
    }, 'Coupon applied successfully');
  } catch (error) {
    next(error);
  }
}

// Admin: List all orders
async function getAllOrdersAdmin(req, res, next) {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    let sql = `SELECT * FROM orders WHERE 1=1`;
    const params = [];

    if (status && status !== 'all') {
      sql += ` AND order_status = ?`;
      params.push(status);
    }

    if (search) {
      sql += ` AND (order_number LIKE ? OR customer_name LIKE ? OR customer_email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY created_at DESC`;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), offset);

    const orders = await query(sql, params);

    for (const order of orders) {
      const items = await query(
        `SELECT oi.*,
          (SELECT image_url FROM product_images WHERE product_id = oi.product_id ORDER BY is_primary DESC, display_order ASC, id ASC LIMIT 1) AS db_primary_image
         FROM order_items oi
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items.map(it => {
        let finalImg = it.image_url;
        if (!finalImg || finalImg.includes('best-handbag.png')) {
          finalImg = it.db_primary_image || finalImg;
        }
        if (!finalImg) {
          finalImg = it.db_primary_image || it.image_url || '/assets/bestsellers/best-handbag.png';
        }
        return {
          ...it,
          image_url: finalImg,
          image: finalImg
        };
      });
      if (typeof order.shipping_address === 'string') {
        try { order.shipping_address = JSON.parse(order.shipping_address); } catch (e) {}
      }
    }

    const countResult = await query(`SELECT COUNT(*) AS total FROM orders`);
    const total = countResult[0] ? countResult[0].total : orders.length;

    return sendSuccess(res, {
      orders,
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

// Admin: Update order status
async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { order_status, payment_status, notes } = req.body;

    await query(
      `UPDATE orders SET
         order_status = COALESCE(?, order_status),
         payment_status = COALESCE(?, payment_status),
         notes = COALESCE(?, notes)
       WHERE id = ?`,
      [order_status || null, payment_status || null, notes || null, id]
    );

    return sendSuccess(res, { id }, 'Order status updated successfully');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createOrder,
  getOrderDetails,
  getMyOrders,
  validateCoupon,
  getAllOrdersAdmin,
  updateOrderStatus
};

