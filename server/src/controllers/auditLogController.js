const { query } = require('../config/db');

// GET /api/audit-logs
async function getAuditLogs(req, res) {
  try {
    const { action, entity_type, search, startDate, endDate, limit = 100, page = 1 } = req.query;

    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (action && action !== 'all') {
      sql += ' AND action = ?';
      params.push(action);
    }

    if (entity_type && entity_type !== 'all') {
      sql += ' AND entity_type = ?';
      params.push(entity_type);
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ' AND (summary LIKE ? OR product_name LIKE ? OR performed_by LIKE ?)';
      params.push(q, q, q);
    }

    if (startDate) {
      sql += ' AND created_at >= ?';
      params.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
      sql += ' AND created_at <= ?';
      params.push(`${endDate} 23:59:59`);
    }

    // Count query
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countRows = await query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const numLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const offset = Math.max(0, (parseInt(page, 10) - 1) * numLimit);
    params.push(numLimit, offset);

    const logs = await query(sql, params);

    res.json({
      total,
      page: parseInt(page, 10) || 1,
      limit: numLimit,
      logs
    });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
}

// Helper to insert audit log record directly
async function recordAuditLog({
  entity_type,
  entity_id = null,
  action,
  summary,
  old_values = null,
  new_values = null,
  product_id = null,
  product_name = null,
  product_image = null,
  performed_by = 'Admin Staff'
}) {
  try {
    await query(`
      INSERT INTO audit_logs (
        entity_type, entity_id, action, summary, old_values, new_values,
        product_id, product_name, product_image, performed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      entity_type,
      entity_id ? String(entity_id) : null,
      action,
      summary,
      old_values ? JSON.stringify(old_values) : null,
      new_values ? JSON.stringify(new_values) : null,
      product_id ? String(product_id) : null,
      product_name || null,
      product_image || null,
      performed_by || 'Admin Staff'
    ]);
  } catch (e) {
    console.error('recordAuditLog error:', e);
  }
}

module.exports = {
  getAuditLogs,
  recordAuditLog
};

