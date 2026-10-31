const { query } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { deductInventoryForOrder, restoreInventoryForOrder } = require('../utils/inventory');
const { calculateOrderTax } = require('../utils/gst');
const { findOrCreateCustomer } = require('../utils/customerHelper');

// Generate daily sequential POS bill numbers: NP-YYYYMMDD-0001, 0002, ...
async function generateNextPosOrderNumber() {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const prefix = `NP-${dateStr}-`;

  const rows = await query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(order_number, ?) AS UNSIGNED)), 0) AS max_seq
     FROM orders
     WHERE order_number LIKE ? AND order_type = 'pos'`,
    [prefix.length + 1, `${prefix}%`]
  );

  const nextSeq = Number(rows[0]?.max_seq || 0) + 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

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

    // Automatically deduct inventory for online order and log transaction
    await deductInventoryForOrder(validatedItems, order_number, { query });

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

// Admin: Update order status (with auto-restock if cancelled)
async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { order_status, payment_status, notes } = req.body;

    const existingOrders = await query(`SELECT * FROM orders WHERE id = ?`, [id]);
    if (existingOrders.length === 0) {
      return sendError(res, 'Order not found', 404);
    }
    const existing = existingOrders[0];

    // If changing to cancelled and was not already cancelled, restock items
    if (order_status === 'cancelled' && existing.order_status !== 'cancelled') {
      const items = await query(`SELECT * FROM order_items WHERE order_id = ?`, [id]);
      await restoreInventoryForOrder(items, `CANCEL-${existing.order_number}`, { query });
    }

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

// Admin / POS Counter: Create In-Store POS Order
async function createPOSOrder(req, res, next) {
  try {
    const {
      customer_name = 'Walk-in Customer',
      customer_phone = '',
      customer_email = '',
      items = [],
      payment_method = 'Cash',
      received_amount = 0,
      discount_amount = 0,
      discount_type = 'flat',
      discount_value = 0,
      sales_person_id = null,
      sales_person_name = null,
      notes = ''
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return sendError(res, 'POS order must contain at least one item', 400);
    }

    // 1. Calculate tax breakdown via GST engine
    const taxSummary = calculateOrderTax({
      items,
      discountAmount: discount_amount,
      shippingAmount: 0,
      isGstInclusive: true,
      shippingState: 'Tamil Nadu'
    });

    const order_number = await generateNextPosOrderNumber();
    const grandTotal = taxSummary.grandTotal;
    const received = Number(received_amount) > 0 ? Number(received_amount) : grandTotal;
    const balance = Math.max(0, received - grandTotal);

    // Save or link newly added / recognized customer into users table so customer info is preserved
    let customerUserId = null;
    try {
      customerUserId = await findOrCreateCustomer({
        name: customer_name,
        phone: customer_phone,
        email: customer_email
      });
    } catch (custErr) {
      console.warn('[POS] Could not auto-save customer info:', custErr.message);
    }

    const orderResult = await query(
      `INSERT INTO orders (
        order_number, user_id, customer_name, customer_email, customer_phone,
        shipping_address, subtotal, discount, shipping_fee, total_amount,
        payment_method, payment_status, order_status, notes,
        order_type, received_amount, balance_amount, gst_rate, is_gst_inclusive,
        taxable_amount, cgst_amount, sgst_amount, igst_amount,
        sales_person_id, sales_person_name, discount_type, discount_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, 'paid', 'delivered', ?, 'pos', ?, ?, 18.00, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order_number,
        customerUserId || (req.user ? req.user.id : null),
        customer_name.trim() || 'Walk-in Customer',
        customer_email.trim() || 'walkin@npgrandshopping.com',
        customer_phone.trim() || '',
        JSON.stringify({ address: 'In-Store POS Billing Counter', city: 'Chennai', state: 'Tamil Nadu' }),
        taxSummary.subtotal,
        taxSummary.discountAmount,
        grandTotal,
        payment_method,
        notes || 'In-store POS counter billing',
        received,
        balance,
        taxSummary.taxableAmount,
        taxSummary.cgstAmount,
        taxSummary.sgstAmount,
        taxSummary.igstAmount,
        sales_person_id ? parseInt(sales_person_id, 10) : null,
        sales_person_name || null,
        discount_type || 'flat',
        parseFloat(discount_value) || parseFloat(discount_amount) || 0
      ]
    );

    const orderId = orderResult.insertId;

    // 2. Insert line items
    for (const item of taxSummary.items) {
      const itemSalesPersonId = item.sales_person_id ? parseInt(item.sales_person_id, 10) : (sales_person_id ? parseInt(sales_person_id, 10) : null);
      const itemSalesPersonName = item.sales_person_name || sales_person_name || null;

      await query(
        `INSERT INTO order_items (
          order_id, product_id, product_name, variant_info, sku, hsn_code,
          price, quantity, gst_rate, taxable_amount, cgst_amount, sgst_amount,
          igst_amount, total_tax, total, image_url,
          sales_person_id, sales_person_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          item.product_id || item.id,
          item.product_name || item.name,
          item.variant_info || (item.size ? `${item.color || ''} · ${item.size}` : item.color || null),
          item.sku || null,
          item.hsn_code || '4202',
          item.price,
          item.quantity,
          item.gstRate || 18.00,
          item.taxableAmount,
          item.cgstAmount,
          item.sgstAmount,
          item.igstAmount,
          item.totalTax,
          item.lineTotal,
          item.image || item.image_url || null,
          itemSalesPersonId,
          itemSalesPersonName
        ]
      );
    }

    // 3. Deduct stock from product_variants and products tables
    await deductInventoryForOrder(taxSummary.items, order_number, { query });

    // 4. Log POS sale in audit logs
    try {
      const { recordAuditLog } = require('./auditLogController');
      const firstItem = taxSummary.items[0];
      await recordAuditLog({
        entity_type: 'pos',
        entity_id: order_number,
        action: 'pos_sale',
        summary: `Walk-in POS Bill ${order_number} created for ${customer_name.trim() || 'Walk-in'} (Total: ₹${grandTotal}, ${taxSummary.items.length} items)`,
        product_name: firstItem?.product_name || 'POS Bill',
        product_image: firstItem?.image || firstItem?.image_url || null,
        performed_by: sales_person_name || 'Cashier Counter'
      });
    } catch (e) {
      console.error('Audit log error on POS order:', e);
    }

    return sendSuccess(res, {
      order_id: orderId,
      order_number,
      total_amount: grandTotal,
      subtotal: taxSummary.subtotal,
      discount: taxSummary.discountAmount,
      taxable_amount: taxSummary.taxableAmount,
      cgst_amount: taxSummary.cgstAmount,
      sgst_amount: taxSummary.sgstAmount,
      igst_amount: taxSummary.igstAmount,
      received_amount: received,
      balance_amount: balance,
      customer_name: customer_name.trim() || 'Walk-in Customer',
      customer_phone,
      payment_method,
      items: taxSummary.items,
      created_at: new Date().toISOString()
    }, 'POS order placed successfully', 201);
  } catch (error) {
    next(error);
  }
}

// Admin / POS: Process Order Returns or Replacements
async function processOrderReturn(req, res, next) {
  try {
    const { id: orderId } = req.params;
    const {
      return_type = 'return',
      returned_items = [],
      replacement_items = [],
      refund_amount = 0,
      balance_collected = 0,
      reason = 'Customer Request'
    } = req.body;

    const orders = await query(`SELECT * FROM orders WHERE id = ?`, [orderId]);
    if (orders.length === 0) {
      return sendError(res, 'Order not found', 404);
    }
    const order = orders[0];

    // 1. Record return in order_returns table
    await query(
      `INSERT INTO order_returns (
        order_id, order_number, return_type, returned_items, replacement_items,
        total_refund_amount, balance_collected, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        order.order_number,
        return_type,
        JSON.stringify(returned_items),
        JSON.stringify(replacement_items),
        Number(refund_amount) || 0,
        Number(balance_collected) || 0,
        reason
      ]
    );

    // 2. Restore stock for returned items
    if (returned_items.length > 0) {
      await restoreInventoryForOrder(returned_items, `RETURN-${order.order_number}`, { query });

      // Update returned_quantity on order_items
      for (const ret of returned_items) {
        if (ret.item_id || ret.id) {
          await query(
            `UPDATE order_items SET returned_quantity = returned_quantity + ? WHERE id = ?`,
            [ret.quantity || 1, ret.item_id || ret.id]
          );
        }
      }
    }

    // 3. If replacements, deduct inventory for replacement items
    if (replacement_items.length > 0) {
      await deductInventoryForOrder(replacement_items, `EXCHANGE-${order.order_number}`, { query });
    }

    return sendSuccess(res, { order_id: orderId, return_type }, 'Return processed successfully');
  } catch (error) {
    next(error);
  }
}

// Admin: Delete order (with auto-inventory restock)
async function deleteOrderAdmin(req, res, next) {
  try {
    const { id } = req.params;
    const { restock = 'true' } = req.query;

    const orders = await query(`SELECT * FROM orders WHERE id = ?`, [id]);
    if (orders.length === 0) {
      return sendError(res, 'Order not found', 404);
    }
    const order = orders[0];

    // If restock is enabled and order was not already cancelled, restore inventory
    if (restock !== 'false' && order.order_status !== 'cancelled') {
      const items = await query(`SELECT * FROM order_items WHERE order_id = ?`, [id]);
      if (items.length > 0) {
        await restoreInventoryForOrder(items, `DELETE-${order.order_number}`, { query });
      }
    }

    // Delete order (cascades to order_items and order_returns)
    await query(`DELETE FROM orders WHERE id = ?`, [id]);

    return sendSuccess(res, { id, order_number: order.order_number }, 'Order deleted successfully');
  } catch (error) {
    next(error);
  }
}

// Admin / POS: Edit products/items in a POS Billing order
async function updatePOSOrderItems(req, res, next) {
  try {
    const { id } = req.params;
    const { items = [], discount_amount = 0, notes = '' } = req.body;

    const orders = await query(`SELECT * FROM orders WHERE id = ?`, [id]);
    if (orders.length === 0) {
      return sendError(res, 'Order not found', 404);
    }
    const order = orders[0];

    if ((order.order_type || '').toLowerCase() !== 'pos') {
      return sendError(res, 'Only POS billing orders can have line items edited directly', 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return sendError(res, 'Order must contain at least one item', 400);
    }

    // 1. Restore previous inventory for this order
    const oldItems = await query(`SELECT * FROM order_items WHERE order_id = ?`, [id]);
    if (oldItems.length > 0 && order.order_status !== 'cancelled') {
      await restoreInventoryForOrder(oldItems, `POS-EDIT-RESTORE-${order.order_number}`, { query });
    }

    // 2. Calculate updated taxes
    const taxSummary = calculateOrderTax({
      items,
      discountAmount: Number(discount_amount) || 0,
      shippingAmount: 0,
      isGstInclusive: true,
      shippingState: 'Tamil Nadu'
    });

    const grandTotal = taxSummary.grandTotal;

    // 3. Delete old items and insert updated items
    await query(`DELETE FROM order_items WHERE order_id = ?`, [id]);

    for (const item of taxSummary.items) {
      await query(
        `INSERT INTO order_items (
          order_id, product_id, product_name, variant_info, sku, hsn_code,
          price, quantity, gst_rate, taxable_amount, cgst_amount, sgst_amount,
          igst_amount, total_tax, total, image_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          item.product_id || item.id,
          item.product_name || item.name,
          item.variant_info || (item.size ? `${item.color || ''} · ${item.size}` : item.color || null),
          item.sku || null,
          item.hsn_code || '4202',
          item.price,
          item.quantity,
          item.gstRate || 18.00,
          item.taxableAmount,
          item.cgstAmount,
          item.sgstAmount,
          item.igstAmount,
          item.totalTax,
          item.lineTotal,
          item.image || item.image_url || null
        ]
      );
    }

    // 4. Update order financial totals
    await query(
      `UPDATE orders SET
         subtotal = ?,
         discount = ?,
         total_amount = ?,
         taxable_amount = ?,
         cgst_amount = ?,
         sgst_amount = ?,
         igst_amount = ?,
         notes = COALESCE(?, notes)
       WHERE id = ?`,
      [
        taxSummary.subtotal,
        taxSummary.discountAmount,
        grandTotal,
        taxSummary.taxableAmount,
        taxSummary.cgstAmount,
        taxSummary.sgstAmount,
        taxSummary.igstAmount,
        notes || null,
        id
      ]
    );

    // 5. Deduct new inventory for updated items
    if (order.order_status !== 'cancelled') {
      await deductInventoryForOrder(taxSummary.items, `POS-EDIT-DEDUCT-${order.order_number}`, { query });
    }

    // Fetch updated order and items
    const updatedOrder = (await query(`SELECT * FROM orders WHERE id = ?`, [id]))[0];
    updatedOrder.items = await query(`SELECT * FROM order_items WHERE order_id = ?`, [id]);

    return sendSuccess(res, updatedOrder, 'POS order items updated successfully');
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
  updateOrderStatus,
  createPOSOrder,
  processOrderReturn,
  deleteOrderAdmin,
  updatePOSOrderItems
};


