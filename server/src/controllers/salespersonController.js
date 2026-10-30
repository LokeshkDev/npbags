const { query } = require('../config/db');
const { recordAuditLog } = require('./auditLogController');

// Helper to build date filter condition for orders
function buildDateCondition(period, startDate, endDate) {
  let condition = '';
  const params = [];

  if (period === 'daily' || period === 'today') {
    condition = 'AND DATE(o.created_at) = CURDATE()';
  } else if (period === 'weekly') {
    condition = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
  } else if (period === 'yearly') {
    condition = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
  } else if (period === 'custom' && startDate && endDate) {
    condition = 'AND DATE(o.created_at) >= ? AND DATE(o.created_at) <= ?';
    params.push(startDate, endDate);
  } else {
    // Default 'monthly' (last 30 days)
    condition = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
  }

  return { condition, params };
}

// GET /api/admin/salespersons
async function getAllSalespersons(req, res) {
  try {
    const { period, startDate, endDate } = req.query;
    let orderDateClause = '';
    const queryParams = [];

    if (period) {
      const { condition, params } = buildDateCondition(period, startDate, endDate);
      orderDateClause = condition;
      queryParams.push(...params);
    }

    const rows = await query(`
      SELECT sp.*,
             sp.commission_percent AS commission_rate,
             COUNT(DISTINCT o.id) AS total_bills_count,
             COALESCE(SUM(o.total_amount), 0) AS total_sales_amount,
             COALESCE(SUM(o.total_amount * (COALESCE(sp.commission_percent, 0) / 100)), 0) AS total_commission_amount
      FROM sales_persons sp
      LEFT JOIN orders o ON o.sales_person_id = sp.id
            AND (o.order_status IS NULL OR o.order_status != 'cancelled')
            ${orderDateClause}
      GROUP BY sp.id
      ORDER BY sp.name ASC
    `, queryParams);

    const formatted = rows.map(r => ({
      ...r,
      total_bills_count: Number(r.total_bills_count) || 0,
      total_sales_amount: Math.round(Number(r.total_sales_amount) * 100) / 100,
      total_commission_amount: Math.round(Number(r.total_commission_amount) * 100) / 100,
      commission_percent: Number(r.commission_percent) || 0,
      commission_rate: Number(r.commission_percent) || 0,
      aov: Number(r.total_bills_count) > 0
        ? Math.round((Number(r.total_sales_amount) / Number(r.total_bills_count)) * 100) / 100
        : 0
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching sales persons:', err);
    res.status(500).json({ error: 'Failed to fetch sales staff' });
  }
}

// GET /api/admin/salespersons/report
// Dedicated endpoint for daily, weekly, monthly, yearly performance & commission reporting
async function getSalespersonReport(req, res) {
  try {
    const { period = 'monthly', startDate, endDate, salesPersonId } = req.query;
    const { condition, params } = buildDateCondition(period, startDate, endDate);

    let specificStaffClause = '';
    const staffParams = [...params];
    if (salesPersonId) {
      specificStaffClause = 'WHERE sp.id = ?';
      staffParams.push(salesPersonId);
    }

    // 1. Per-staff performance metrics
    const staffRows = await query(`
      SELECT sp.id, sp.name, sp.code, sp.phone, sp.commission_percent, sp.is_active, sp.created_at,
             sp.commission_percent AS commission_rate,
             COUNT(DISTINCT o.id) AS no_of_sales_done,
             COALESCE(SUM(o.total_amount), 0) AS total_sales_volume,
             COALESCE(SUM(o.total_amount * (COALESCE(sp.commission_percent, 0) / 100)), 0) AS total_commission_amount
      FROM sales_persons sp
      LEFT JOIN orders o ON o.sales_person_id = sp.id
            AND (o.order_status IS NULL OR o.order_status != 'cancelled')
            ${condition}
      ${specificStaffClause}
      GROUP BY sp.id
      ORDER BY total_sales_volume DESC, no_of_sales_done DESC, sp.name ASC
    `, staffParams);

    const staff = staffRows.map(s => {
      const salesCount = Number(s.no_of_sales_done) || 0;
      const salesVol = Math.round(Number(s.total_sales_volume) * 100) / 100;
      const commAmt = Math.round(Number(s.total_commission_amount) * 100) / 100;
      const aov = salesCount > 0 ? Math.round((salesVol / salesCount) * 100) / 100 : 0;
      return {
        ...s,
        no_of_sales_done: salesCount,
        total_sales_volume: salesVol,
        total_commission_amount: commAmt,
        commission_percent: Number(s.commission_percent) || 0,
        commission_rate: Number(s.commission_percent) || 0,
        aov
      };
    });

    // 2. Summary aggregates
    const totalStaff = staff.length;
    const activeStaff = staff.filter(s => s.is_active).length;
    const totalBills = staff.reduce((sum, s) => sum + s.no_of_sales_done, 0);
    const totalSalesVolume = staff.reduce((sum, s) => sum + s.total_sales_volume, 0);
    const totalCommissionDue = staff.reduce((sum, s) => sum + s.total_commission_amount, 0);
    const avgOrderValue = totalBills > 0 ? Math.round((totalSalesVolume / totalBills) * 100) / 100 : 0;

    // 3. Recent attributed transactions in timeframe
    const recentOrders = await query(`
      SELECT o.id, o.order_number, o.order_type, o.customer_name, o.customer_phone,
             o.payment_method, o.total_amount, o.created_at,
             sp.id AS sales_person_id, sp.name AS sales_person_name,
             sp.commission_percent,
             ROUND(o.total_amount * (COALESCE(sp.commission_percent, 0) / 100), 2) AS commission_earned
      FROM orders o
      JOIN sales_persons sp ON o.sales_person_id = sp.id
      WHERE (o.order_status IS NULL OR o.order_status != 'cancelled')
            ${condition}
      ORDER BY o.created_at DESC
      LIMIT 25
    `, params);

    res.json({
      period,
      startDate: startDate || null,
      endDate: endDate || null,
      summary: {
        total_staff: totalStaff,
        active_staff: activeStaff,
        total_bills: totalBills,
        total_sales_volume: Math.round(totalSalesVolume * 100) / 100,
        total_commission_due: Math.round(totalCommissionDue * 100) / 100,
        average_order_value: avgOrderValue
      },
      staff,
      recent_sales: recentOrders
    });
  } catch (err) {
    console.error('Error generating salesperson report:', err);
    res.status(500).json({ error: 'Failed to generate salesperson report' });
  }
}

// POST /api/admin/salespersons
async function createSalesperson(req, res) {
  try {
    const { name, code, phone, commission_percent, commission_rate } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Salesperson name is required' });
    }

    const autoCode = code && code.trim() ? code.trim() : `SP-${Date.now().toString().slice(-4)}`;
    const comm = parseFloat(commission_percent !== undefined ? commission_percent : (commission_rate !== undefined ? commission_rate : 0)) || 0;

    const result = await query(
      `INSERT INTO sales_persons (name, code, phone, commission_percent, is_active) VALUES (?, ?, ?, ?, 1)`,
      [name.trim(), autoCode, phone ? phone.trim() : null, comm]
    );

    const created = await query('SELECT * FROM sales_persons WHERE id = ?', [result.insertId]);

    // Record audit log
    await recordAuditLog({
      userName: req.admin?.name || req.user?.name || 'Admin',
      action: 'staff_created',
      entity: 'salesperson',
      entityId: result.insertId,
      details: {
        name: name.trim(),
        code: autoCode,
        phone: phone || null,
        commission_percent: comm
      },
      ipAddress: req.ip
    });

    res.status(201).json(created[0]);
  } catch (err) {
    console.error('Error creating sales person:', err);
    res.status(500).json({ error: err.message || 'Failed to create sales person' });
  }
}

// PUT /api/admin/salespersons/:id
async function updateSalesperson(req, res) {
  try {
    const { id } = req.params;
    const { name, code, phone, commission_percent, commission_rate, is_active } = req.body;

    const existing = await query('SELECT * FROM sales_persons WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Sales person not found' });
    }

    const current = existing[0];
    const newName = name !== undefined ? name.trim() : current.name;
    const newCode = code !== undefined ? code.trim() : current.code;
    const newPhone = phone !== undefined ? phone : current.phone;
    const commInput = commission_percent !== undefined ? commission_percent : commission_rate;
    const newComm = commInput !== undefined ? parseFloat(commInput) || 0 : current.commission_percent;
    const newActive = is_active !== undefined ? (is_active ? 1 : 0) : current.is_active;

    await query(`
      UPDATE sales_persons SET
        name = ?,
        code = ?,
        phone = ?,
        commission_percent = ?,
        is_active = ?
      WHERE id = ?
    `, [newName, newCode, newPhone, newComm, newActive, id]);

    const updated = await query('SELECT * FROM sales_persons WHERE id = ?', [id]);

    // Record audit log
    await recordAuditLog({
      userName: req.admin?.name || req.user?.name || 'Admin',
      action: 'staff_updated',
      entity: 'salesperson',
      entityId: id,
      details: {
        old_name: current.name,
        new_name: newName,
        old_commission: current.commission_percent,
        new_commission: newComm,
        phone: newPhone
      },
      ipAddress: req.ip
    });

    res.json(updated[0]);
  } catch (err) {
    console.error('Error updating sales person:', err);
    res.status(500).json({ error: 'Failed to update sales person' });
  }
}

// DELETE /api/admin/salespersons/:id
async function deleteSalesperson(req, res) {
  try {
    const { id } = req.params;
    const existing = await query('SELECT * FROM sales_persons WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Sales person not found' });
    }

    const staffName = existing[0].name;

    // Detach from orders so historical orders keep the recorded name
    await query('UPDATE orders SET sales_person_id = NULL WHERE sales_person_id = ?', [id]);
    await query('UPDATE order_items SET sales_person_id = NULL WHERE sales_person_id = ?', [id]);

    await query('DELETE FROM sales_persons WHERE id = ?', [id]);

    // Record audit log
    await recordAuditLog({
      userName: req.admin?.name || req.user?.name || 'Admin',
      action: 'staff_deleted',
      entity: 'salesperson',
      entityId: id,
      details: { name: staffName },
      ipAddress: req.ip
    });

    res.json({ success: true, message: `Sales person "${staffName}" deleted successfully` });
  } catch (err) {
    console.error('Error deleting sales person:', err);
    res.status(500).json({ error: 'Failed to delete sales person' });
  }
}

module.exports = {
  getAllSalespersons,
  getSalespersonReport,
  createSalesperson,
  updateSalesperson,
  deleteSalesperson
};
