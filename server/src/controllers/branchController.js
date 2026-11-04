const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

// 1. Get all branches with user count
async function getAllBranches(req, res, next) {
  try {
    const branches = await query(`
      SELECT b.*,
             (SELECT COUNT(*) FROM users u WHERE u.branch_id = b.id AND u.role IN ('branch_admin', 'branch_staff', 'admin')) AS staff_count
      FROM branches b
      ORDER BY b.id ASC
    `);

    return sendSuccess(res, { branches }, 'Branches retrieved successfully');
  } catch (error) {
    next(error);
  }
}

// 2. Get single branch by ID with its users
async function getBranchById(req, res, next) {
  try {
    const { id } = req.params;
    const branches = await query('SELECT * FROM branches WHERE id = ?', [id]);
    if (!branches || branches.length === 0) {
      return sendError(res, 'Branch not found', 404);
    }

    const branch = branches[0];
    const users = await query(
      `SELECT id, name, email, role, phone, allowed_menus, created_at
       FROM users
       WHERE branch_id = ? AND role IN ('branch_admin', 'branch_staff', 'admin')
       ORDER BY id ASC`,
      [id]
    );

    branch.users = users.map(u => ({
      ...u,
      allowed_menus: u.allowed_menus ? (typeof u.allowed_menus === 'string' ? JSON.parse(u.allowed_menus) : u.allowed_menus) : null
    }));

    return sendSuccess(res, { branch }, 'Branch details retrieved');
  } catch (error) {
    next(error);
  }
}

// 3. Create a new branch
async function createBranch(req, res, next) {
  try {
    const { name, code, phone, email, address, city, state, pincode, is_active } = req.body;

    if (!name || !code) {
      return sendError(res, 'Branch Name and unique Code are required', 400);
    }

    const cleanCode = code.trim().toUpperCase();
    const existing = await query('SELECT id FROM branches WHERE UPPER(code) = ?', [cleanCode]);
    if (existing.length > 0) {
      return sendError(res, `A branch with code "${cleanCode}" already exists`, 409);
    }

    const result = await query(
      `INSERT INTO branches (name, code, phone, email, address, city, state, pincode, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        cleanCode,
        phone ? phone.trim() : null,
        email ? email.trim() : null,
        address ? address.trim() : null,
        city ? city.trim() : null,
        state ? state.trim() : null,
        pincode ? pincode.trim() : null,
        is_active === false || is_active === 0 ? 0 : 1
      ]
    );

    const newBranch = await query('SELECT * FROM branches WHERE id = ?', [result.insertId]);
    return sendSuccess(res, { branch: newBranch[0] }, 'Branch created successfully', 201);
  } catch (error) {
    next(error);
  }
}

// 4. Update branch
async function updateBranch(req, res, next) {
  try {
    const { id } = req.params;
    const { name, code, phone, email, address, city, state, pincode, is_active } = req.body;

    const existing = await query('SELECT * FROM branches WHERE id = ?', [id]);
    if (existing.length === 0) {
      return sendError(res, 'Branch not found', 404);
    }

    let cleanCode = existing[0].code;
    if (code) {
      cleanCode = code.trim().toUpperCase();
      const duplicate = await query('SELECT id FROM branches WHERE UPPER(code) = ? AND id != ?', [cleanCode, id]);
      if (duplicate.length > 0) {
        return sendError(res, `Code "${cleanCode}" is already in use by another branch`, 409);
      }
    }

    await query(
      `UPDATE branches SET
         name = COALESCE(?, name),
         code = COALESCE(?, code),
         phone = ?,
         email = ?,
         address = ?,
         city = ?,
         state = ?,
         pincode = ?,
         is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        name ? name.trim() : null,
        cleanCode,
        phone !== undefined ? (phone ? phone.trim() : null) : existing[0].phone,
        email !== undefined ? (email ? email.trim() : null) : existing[0].email,
        address !== undefined ? (address ? address.trim() : null) : existing[0].address,
        city !== undefined ? (city ? city.trim() : null) : existing[0].city,
        state !== undefined ? (state ? state.trim() : null) : existing[0].state,
        pincode !== undefined ? (pincode ? pincode.trim() : null) : existing[0].pincode,
        is_active !== undefined ? (is_active ? 1 : 0) : existing[0].is_active,
        id
      ]
    );

    const updated = await query('SELECT * FROM branches WHERE id = ?', [id]);
    return sendSuccess(res, { branch: updated[0] }, 'Branch updated successfully');
  } catch (error) {
    next(error);
  }
}

// 5. Delete branch
async function deleteBranch(req, res, next) {
  try {
    const { id } = req.params;
    if (String(id) === '1') {
      return sendError(res, 'Cannot delete the Main Head Store branch', 400);
    }

    const branch = await query('SELECT id, name FROM branches WHERE id = ?', [id]);
    if (branch.length === 0) {
      return sendError(res, 'Branch not found', 404);
    }

    // Unlink users from this branch
    await query('UPDATE users SET branch_id = 1 WHERE branch_id = ?', [id]);
    await query('DELETE FROM branches WHERE id = ?', [id]);

    return sendSuccess(res, null, `Branch "${branch[0].name}" deleted successfully`);
  } catch (error) {
    next(error);
  }
}

// 6. Get all branch users across all branches
async function getAllBranchUsers(req, res, next) {
  try {
    const users = await query(`
      SELECT u.id, u.name, u.email, u.role, u.branch_id, u.allowed_menus, u.phone, u.created_at,
             b.name AS branch_name, b.code AS branch_code
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      WHERE u.role IN ('branch_admin', 'branch_staff', 'admin')
      ORDER BY u.id ASC
    `);

    const parsedUsers = users.map(u => ({
      ...u,
      allowed_menus: u.allowed_menus ? (typeof u.allowed_menus === 'string' ? JSON.parse(u.allowed_menus) : u.allowed_menus) : null
    }));

    return sendSuccess(res, { users: parsedUsers }, 'Branch users retrieved');
  } catch (error) {
    next(error);
  }
}

// 7. Create a new branch user login
async function createBranchUser(req, res, next) {
  try {
    const { name, email, password, role, branch_id, allowed_menus, phone } = req.body;

    if (!name || !email || !password) {
      return sendError(res, 'Name, email, and password are required', 400);
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing.length > 0) {
      return sendError(res, `A user with email "${cleanEmail}" already exists`, 409);
    }

    const assignedRole = role && ['branch_admin', 'branch_staff', 'admin'].includes(role) ? role : 'branch_admin';
    const assignedBranchId = branch_id ? parseInt(branch_id, 10) : 1;

    // Default allowed menus for branch staff if not explicitly configured
    const menus = Array.isArray(allowed_menus) && allowed_menus.length > 0
      ? allowed_menus
      : ['dashboard', 'pos', 'orders', 'inventory', 'products', 'customers'];

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (name, email, password, role, branch_id, allowed_menus, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), cleanEmail, passwordHash, assignedRole, assignedBranchId, JSON.stringify(menus), phone ? phone.trim() : null]
    );

    const created = await query(
      `SELECT u.id, u.name, u.email, u.role, u.branch_id, u.allowed_menus, u.phone,
              b.name AS branch_name, b.code AS branch_code
       FROM users u
       LEFT JOIN branches b ON u.branch_id = b.id
       WHERE u.id = ?`,
      [result.insertId]
    );

    const u = created[0];
    if (u.allowed_menus && typeof u.allowed_menus === 'string') {
      try { u.allowed_menus = JSON.parse(u.allowed_menus); } catch (e) {}
    }

    return sendSuccess(res, { user: u }, 'Branch user created successfully', 201);
  } catch (error) {
    next(error);
  }
}

// 8. Update branch user
async function updateBranchUser(req, res, next) {
  try {
    const { id } = req.params;
    const { name, email, password, role, branch_id, allowed_menus, phone } = req.body;

    const existing = await query('SELECT * FROM users WHERE id = ?', [id]);
    if (existing.length === 0) {
      return sendError(res, 'User not found', 404);
    }

    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      const duplicate = await query('SELECT id FROM users WHERE email = ? AND id != ?', [cleanEmail, id]);
      if (duplicate.length > 0) {
        return sendError(res, `Email "${cleanEmail}" is already used by another user`, 409);
      }
    }

    let passwordHash = existing[0].password;
    if (password && password.trim()) {
      passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    const assignedRole = role && ['branch_admin', 'branch_staff', 'admin'].includes(role) ? role : existing[0].role;
    const assignedBranchId = branch_id !== undefined ? (branch_id ? parseInt(branch_id, 10) : null) : existing[0].branch_id;

    let menusJson = existing[0].allowed_menus;
    if (allowed_menus !== undefined) {
      menusJson = Array.isArray(allowed_menus) ? JSON.stringify(allowed_menus) : null;
    }

    await query(
      `UPDATE users SET
         name = COALESCE(?, name),
         email = COALESCE(?, email),
         password = ?,
         role = ?,
         branch_id = ?,
         allowed_menus = ?,
         phone = ?
       WHERE id = ?`,
      [
        name ? name.trim() : null,
        email ? email.toLowerCase().trim() : null,
        passwordHash,
        assignedRole,
        assignedBranchId,
        menusJson,
        phone !== undefined ? (phone ? phone.trim() : null) : existing[0].phone,
        id
      ]
    );

    const updated = await query(
      `SELECT u.id, u.name, u.email, u.role, u.branch_id, u.allowed_menus, u.phone,
              b.name AS branch_name, b.code AS branch_code
       FROM users u
       LEFT JOIN branches b ON u.branch_id = b.id
       WHERE u.id = ?`,
      [id]
    );

    const u = updated[0];
    if (u.allowed_menus && typeof u.allowed_menus === 'string') {
      try { u.allowed_menus = JSON.parse(u.allowed_menus); } catch (e) {}
    }

    return sendSuccess(res, { user: u }, 'Branch user updated successfully');
  } catch (error) {
    next(error);
  }
}

// 9. Delete branch user
async function deleteBranchUser(req, res, next) {
  try {
    const { id } = req.params;
    if (String(id) === '1') {
      return sendError(res, 'Cannot delete the primary Store Administrator account', 400);
    }

    const user = await query('SELECT id, name FROM users WHERE id = ?', [id]);
    if (user.length === 0) {
      return sendError(res, 'User not found', 404);
    }

    await query('DELETE FROM users WHERE id = ?', [id]);
    return sendSuccess(res, null, `Branch user "${user[0].name}" deleted`);
  } catch (error) {
    next(error);
  }
}

// 10. Get all products and live stock pushed to a branch
async function getBranchStocks(req, res, next) {
  try {
    const { id } = req.params;
    const stocks = await query(`
      SELECT bs.id, bs.branch_id, bs.product_id, bs.stock, bs.low_stock_threshold, bs.is_active, bs.updated_at,
             p.name AS product_name, p.price, p.sale_price, p.mrp, p.barcode_short_name,
             COALESCE(p.stock, 0) AS main_branch_stock,
             (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) AS image,
             c.name AS category_name, c.id AS category_id
      FROM branch_stocks bs
      JOIN products p ON bs.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE bs.branch_id = ?
      ORDER BY bs.updated_at DESC, p.name ASC
    `, [id]);

    return sendSuccess(res, { stocks }, 'Branch stocks retrieved');
  } catch (error) {
    next(error);
  }
}

// 11. Push specific product(s) to a branch with allocated stock
async function pushProductsToBranch(req, res, next) {
  try {
    const { id } = req.params;
    const { products } = req.body; // Array of { product_id, stock, low_stock_threshold } or single object

    const branch = await query('SELECT id, name FROM branches WHERE id = ?', [id]);
    if (branch.length === 0) {
      return sendError(res, 'Target branch not found', 404);
    }

    const items = Array.isArray(products) ? products : [req.body];
    if (items.length === 0 || !items[0].product_id) {
      return sendError(res, 'At least one product with product_id is required', 400);
    }

    let affectedCount = 0;
    for (const item of items) {
      const pId = String(item.product_id);
      const stock = Math.max(0, parseInt(item.stock, 10) || 0);
      const lowThresh = Math.max(1, parseInt(item.low_stock_threshold, 10) || 5);

      await query(`
        INSERT INTO branch_stocks (branch_id, product_id, stock, low_stock_threshold, is_active)
        VALUES (?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
          stock = VALUES(stock),
          low_stock_threshold = VALUES(low_stock_threshold),
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP
      `, [id, pId, stock, lowThresh]);
      affectedCount++;
    }

    return sendSuccess(res, { count: affectedCount }, `Successfully pushed ${affectedCount} product(s) to ${branch[0].name}`);
  } catch (error) {
    next(error);
  }
}

// 12. Push an entire Category to a branch with default stock
async function pushCategoryToBranch(req, res, next) {
  try {
    const { id } = req.params;
    const { category_id, default_stock = 10, low_stock_threshold = 5 } = req.body;

    if (!category_id) {
      return sendError(res, 'Category ID is required', 400);
    }

    const branch = await query('SELECT id, name FROM branches WHERE id = ?', [id]);
    if (branch.length === 0) {
      return sendError(res, 'Target branch not found', 404);
    }

    const cat = await query('SELECT id, name FROM categories WHERE id = ?', [category_id]);
    if (cat.length === 0) {
      return sendError(res, 'Category not found', 404);
    }

    // Get all products belonging to this category
    const catProducts = await query('SELECT id, name FROM products WHERE category_id = ?', [category_id]);
    if (catProducts.length === 0) {
      return sendError(res, `No products found under category "${cat[0].name}"`, 404);
    }

    const stock = Math.max(0, parseInt(default_stock, 10) || 0);
    const lowThresh = Math.max(1, parseInt(low_stock_threshold, 10) || 5);

    let pushedCount = 0;
    for (const prod of catProducts) {
      await query(`
        INSERT INTO branch_stocks (branch_id, product_id, stock, low_stock_threshold, is_active)
        VALUES (?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
          stock = VALUES(stock),
          low_stock_threshold = VALUES(low_stock_threshold),
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP
      `, [id, prod.id, stock, lowThresh]);
      pushedCount++;
    }

    return sendSuccess(
      res,
      { pushed_count: pushedCount, category_name: cat[0].name, branch_name: branch[0].name },
      `Successfully pushed ${pushedCount} products from category "${cat[0].name}" to ${branch[0].name}`
    );
  } catch (error) {
    next(error);
  }
}

// 13. Update branch product stock
async function updateBranchProductStock(req, res, next) {
  try {
    const { id, productId } = req.params;
    const { stock, low_stock_threshold, is_active } = req.body;

    const existing = await query('SELECT id, stock, is_active, low_stock_threshold FROM branch_stocks WHERE branch_id = ? AND product_id = ?', [id, productId]);
    if (existing.length === 0) {
      await query(`
        INSERT INTO branch_stocks (branch_id, product_id, stock, low_stock_threshold, is_active)
        VALUES (?, ?, ?, ?, ?)
      `, [
        id,
        productId,
        stock !== undefined ? parseInt(stock, 10) : 0,
        low_stock_threshold !== undefined ? parseInt(low_stock_threshold, 10) : 5,
        is_active !== undefined ? (is_active ? 1 : 0) : 1
      ]);
    } else {
      await query(`
        UPDATE branch_stocks
        SET stock = COALESCE(?, stock),
            low_stock_threshold = COALESCE(?, low_stock_threshold),
            is_active = COALESCE(?, is_active),
            updated_at = CURRENT_TIMESTAMP
        WHERE branch_id = ? AND product_id = ?
      `, [
        stock !== undefined ? parseInt(stock, 10) : null,
        low_stock_threshold !== undefined ? parseInt(low_stock_threshold, 10) : null,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        id,
        productId
      ]);
    }

    return sendSuccess(res, null, 'Branch product stock updated');
  } catch (error) {
    next(error);
  }
}

// 14. Push / transfer stock from regional branch back to Main Branch (Head Warehouse)
async function pushStockToMainBranch(req, res, next) {
  try {
    const { id, productId } = req.params;
    const { quantity } = req.body;
    const transferQty = parseInt(quantity, 10);

    if (!transferQty || transferQty <= 0) {
      return sendError(res, 'Transfer quantity must be greater than 0', 400);
    }

    // 1. Fetch current branch stock
    const branchRows = await query(`
      SELECT bs.*, b.name AS branch_name, p.name AS product_name, COALESCE(p.stock, 0) AS main_stock
      FROM branch_stocks bs
      JOIN branches b ON bs.branch_id = b.id
      JOIN products p ON bs.product_id = p.id
      WHERE bs.branch_id = ? AND bs.product_id = ?
    `, [id, productId]);

    if (branchRows.length === 0) {
      return sendError(res, 'Product is not allocated to this branch', 404);
    }

    const currentBranchStock = parseInt(branchRows[0].stock, 10) || 0;
    if (currentBranchStock < transferQty) {
      return sendError(res, `Cannot transfer ${transferQty} unit(s). Branch only has ${currentBranchStock} unit(s) available.`, 400);
    }

    // 2. Decrement branch stock
    await query(`
      UPDATE branch_stocks
      SET stock = stock - ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE branch_id = ? AND product_id = ?
    `, [transferQty, id, productId]);

    // 3. Increment Main Branch stock (Central warehouse products table)
    await query(`
      UPDATE products
      SET stock = stock + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [transferQty, productId]);

    // Update variant stock if single variant exists
    try {
      const vRows = await query('SELECT id, stock_quantity FROM product_variants WHERE product_id = ?', [productId]);
      if (vRows.length === 1) {
        await query('UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?', [transferQty, vRows[0].id]);
      }
    } catch (vErr) {
      console.warn('Variant stock update skipped:', vErr.message);
    }

    // 4. Record transaction in audit log
    const newBranchStock = currentBranchStock - transferQty;
    const newMainStock = (parseInt(branchRows[0].main_stock, 10) || 0) + transferQty;

    try {
      await query(`
        INSERT INTO inventory_transactions (
          product_id, variant_sku, type, change_qty, balance_after, reference, notes, source, user_id
        )
        VALUES (?, ?, 'Branch Push to Main', ?, ?, ?, ?, 'branch_transfer', ?)
      `, [
        productId,
        branchRows[0].sku || 'DEFAULT',
        transferQty,
        newMainStock,
        `TRANSFER-FROM-BR-${id}`,
        `Stock pushed to Main Branch from ${branchRows[0].branch_name} (Branch #${id})`,
        req.user?.id || null
      ]);
    } catch (tErr) {
      console.warn('Inventory transaction log skipped:', tErr.message);
    }

    return sendSuccess(res, {
      product_id: productId,
      product_name: branchRows[0].product_name,
      transferred_qty: transferQty,
      branch_stock: newBranchStock,
      main_branch_stock: newMainStock
    }, `Successfully transferred ${transferQty} unit(s) of "${branchRows[0].product_name}" to Main Branch! Main Branch stock is now ${newMainStock}.`);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
  getAllBranchUsers,
  createBranchUser,
  updateBranchUser,
  deleteBranchUser,
  getBranchStocks,
  pushProductsToBranch,
  pushCategoryToBranch,
  updateBranchProductStock,
  pushStockToMainBranch
};

