/**
 * Inventory Management & Omnichannel Stock Synchronization Service
 * Updates variant quantities, master stock, godowns, and logs to inventory_transactions.
 * For NP Grand Shopping
 */

/**
 * Deducts inventory for an order (POS or Online)
 */
async function deductInventoryForOrder(items = [], reference = '', pool) {
  if (!Array.isArray(items) || items.length === 0) return;

  for (const item of items) {
    const qty = Math.max(1, parseInt(item.quantity || item.qty, 10) || 1);
    const productId = item.product_id || item.id || null;
    const sku = item.sku || null;
    const productName = (item.product_name || item.name || '').trim();
    const size = item.size || item.size_name || null;
    const color = item.color || item.color_name || null;

    try {
      let targetProduct = null;

      // 1. Resolve product by string ID (e.g. 'prod-1') or Name
      if (productId) {
        const rows = await pool.query('SELECT * FROM products WHERE id = ?', [productId]);
        if (rows && rows.length > 0) targetProduct = rows[0];
      }
      if (!targetProduct && productName) {
        const rows = await pool.query('SELECT * FROM products WHERE name = ? OR barcode_short_name = ?', [productName, productName]);
        if (rows && rows.length > 0) targetProduct = rows[0];
      }

      if (!targetProduct) continue;
      const pId = targetProduct.id;

      // 2. Resolve & Update product_variants table
      let variantUpdated = false;
      let newVariantStock = null;
      let variantSku = sku || 'DEFAULT';

      const variants = await pool.query('SELECT * FROM product_variants WHERE product_id = ?', [pId]);
      if (variants && variants.length > 0) {
        let targetVariant = variants.find(v => {
          if (sku && v.sku === sku) return true;
          if (size && color && String(v.size_name).toLowerCase() === String(size).toLowerCase() && String(v.color_name).toLowerCase() === String(color).toLowerCase()) return true;
          if (size && String(v.size_name).toLowerCase() === String(size).toLowerCase()) return true;
          return false;
        }) || variants[0];

        variantSku = targetVariant.sku || (size && color ? `${size}-${color}` : 'DEFAULT');
        const updatedStock = Math.max(0, (targetVariant.stock_quantity || 0) - qty);
        await pool.query('UPDATE product_variants SET stock_quantity = ? WHERE id = ?', [updatedStock, targetVariant.id]);
        newVariantStock = updatedStock;
        variantUpdated = true;
      }

      // 3. Compute and save master product stock
      let newTotalStock;
      if (variantUpdated) {
        const sumRow = await pool.query('SELECT SUM(stock_quantity) as total FROM product_variants WHERE product_id = ?', [pId]);
        newTotalStock = sumRow[0]?.total || 0;
        await pool.query('UPDATE products SET stock = ? WHERE id = ?', [newTotalStock, pId]);
      } else {
        const currentStock = parseInt(targetProduct.stock, 10) || 0;
        newTotalStock = Math.max(0, currentStock - qty);
        await pool.query('UPDATE products SET stock = ? WHERE id = ?', [newTotalStock, pId]);
      }

      // 4. Deduct godown stock if present
      try {
        await pool.query(
          'UPDATE product_godown_stock SET stock = GREATEST(0, stock - ?) WHERE product_id = ? ORDER BY stock DESC LIMIT 1',
          [qty, pId]
        );
      } catch (_) {}

      // 5. Insert audit log entry
      try {
        await pool.query(
          `INSERT INTO inventory_transactions (product_id, variant_sku, type, change_qty, balance_after, reference, notes, size, color, barcode)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pId,
            variantSku,
            'Order Sale',
            -qty,
            newVariantStock !== null ? newVariantStock : newTotalStock,
            reference || 'ORDER-SALE',
            `Deducted ${qty} units for order ${reference}`,
            size,
            color,
            item.barcode || null
          ]
        );
      } catch (_) {}
    } catch (err) {
      console.warn(`[Inventory] Reduction error:`, err.message);
    }
  }
}

/**
 * Restores inventory for an order cancellation or return
 */
async function restoreInventoryForOrder(items = [], reference = '', pool) {
  if (!Array.isArray(items) || items.length === 0) return;

  for (const item of items) {
    const qty = Math.max(1, parseInt(item.quantity || item.qty, 10) || 1);
    const productId = item.product_id || item.id || null;
    const sku = item.sku || null;
    const productName = (item.product_name || item.name || '').trim();
    const size = item.size || item.size_name || null;
    const color = item.color || item.color_name || null;

    try {
      let targetProduct = null;
      if (productId) {
        const rows = await pool.query('SELECT * FROM products WHERE id = ?', [productId]);
        if (rows && rows.length > 0) targetProduct = rows[0];
      }
      if (!targetProduct && productName) {
        const rows = await pool.query('SELECT * FROM products WHERE name = ? OR barcode_short_name = ?', [productName, productName]);
        if (rows && rows.length > 0) targetProduct = rows[0];
      }

      if (!targetProduct) continue;
      const pId = targetProduct.id;

      let variantUpdated = false;
      let newVariantStock = null;
      let variantSku = sku || 'DEFAULT';

      const variants = await pool.query('SELECT * FROM product_variants WHERE product_id = ?', [pId]);
      if (variants && variants.length > 0) {
        let targetVariant = variants.find(v => {
          if (sku && v.sku === sku) return true;
          if (size && color && String(v.size_name).toLowerCase() === String(size).toLowerCase() && String(v.color_name).toLowerCase() === String(color).toLowerCase()) return true;
          if (size && String(v.size_name).toLowerCase() === String(size).toLowerCase()) return true;
          return false;
        }) || variants[0];

        variantSku = targetVariant.sku || (size && color ? `${size}-${color}` : 'DEFAULT');
        const updatedStock = (targetVariant.stock_quantity || 0) + qty;
        await pool.query('UPDATE product_variants SET stock_quantity = ? WHERE id = ?', [updatedStock, targetVariant.id]);
        newVariantStock = updatedStock;
        variantUpdated = true;
      }

      let newTotalStock;
      if (variantUpdated) {
        const sumRow = await pool.query('SELECT SUM(stock_quantity) as total FROM product_variants WHERE product_id = ?', [pId]);
        newTotalStock = sumRow[0]?.total || 0;
        await pool.query('UPDATE products SET stock = ? WHERE id = ?', [newTotalStock, pId]);
      } else {
        const currentStock = parseInt(targetProduct.stock, 10) || 0;
        newTotalStock = currentStock + qty;
        await pool.query('UPDATE products SET stock = ? WHERE id = ?', [newTotalStock, pId]);
      }

      // Restock godown location
      try {
        await pool.query(
          'UPDATE product_godown_stock SET stock = stock + ? WHERE product_id = ? ORDER BY godown_id ASC LIMIT 1',
          [qty, pId]
        );
      } catch (_) {}

      // Log transaction
      try {
        await pool.query(
          `INSERT INTO inventory_transactions (product_id, variant_sku, type, change_qty, balance_after, reference, notes, size, color, barcode)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pId,
            variantSku,
            'Order Restock',
            qty,
            newVariantStock !== null ? newVariantStock : newTotalStock,
            reference || 'RESTOCK',
            `Restocked ${qty} units for order ${reference}`,
            size,
            color,
            item.barcode || null
          ]
        );
      } catch (_) {}
    } catch (err) {
      console.warn(`[Inventory] Restock error:`, err.message);
    }
  }
}

module.exports = {
  deductInventoryForOrder,
  restoreInventoryForOrder
};
