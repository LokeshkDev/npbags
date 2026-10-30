const { query } = require('../config/db');

// Helper to record audit log
async function logAudit({ entity_id, action, summary, old_values = null, new_values = null, performed_by = 'Admin' }) {
  try {
    await query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, summary, old_values, new_values, performed_by)
       VALUES ('vendor', ?, ?, ?, ?, ?, ?)`,
      [
        entity_id ? String(entity_id) : null,
        action,
        summary,
        old_values ? JSON.stringify(old_values) : null,
        new_values ? JSON.stringify(new_values) : null,
        performed_by
      ]
    );
  } catch (err) {
    console.error('Audit log error (vendor):', err);
  }
}

// GET /api/vendors
async function getAllVendors(req, res) {
  try {
    const rows = await query(`
      SELECT v.*, 
             COUNT(p.id) AS products_count,
             COALESCE(SUM(p.stock), 0) AS total_stock_units,
             COALESCE(SUM(p.stock * COALESCE(p.purchase_price, p.price * 0.6)), 0) AS total_inventory_value,
             COALESCE((
               SELECT SUM(pb.grand_total) FROM purchase_bills pb
               WHERE pb.vendor_id = v.id AND pb.status <> 'cancelled'
             ), 0) AS total_purchase_value,
             COALESCE((
               SELECT SUM(pb.outstanding_amount) FROM purchase_bills pb
               WHERE pb.vendor_id = v.id AND pb.status <> 'cancelled'
             ), 0) AS total_outstanding,
             (
               SELECT COUNT(*) FROM purchase_bills pb
               WHERE pb.vendor_id = v.id AND pb.status <> 'cancelled'
             ) AS purchase_bills_count,
             (
               SELECT MAX(pb.purchase_date) FROM purchase_bills pb
               WHERE pb.vendor_id = v.id AND pb.status <> 'cancelled'
             ) AS last_purchase_date
      FROM vendors v
      LEFT JOIN products p ON p.vendor_id = v.id AND p.is_active = TRUE
      GROUP BY v.id
      ORDER BY v.name ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching vendors:', err);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
}

// GET /api/vendors/:id
async function getVendorById(req, res) {
  try {
    const { id } = req.params;
    const vendorRows = await query('SELECT * FROM vendors WHERE id = ?', [id]);
    if (vendorRows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const vendor = vendorRows[0];
    const products = await query(`
      SELECT id, name, slug, price, sale_price, purchase_price, purchased_rate, stock, mrp
      FROM products
      WHERE vendor_id = ? AND is_active = TRUE
      ORDER BY name ASC
    `, [id]);

    res.json({ ...vendor, products });
  } catch (err) {
    console.error('Error fetching vendor by id:', err);
    res.status(500).json({ error: 'Failed to fetch vendor' });
  }
}

// POST /api/vendors
async function createVendor(req, res) {
  try {
    const {
      name,
      company_name,
      contact_person,
      phone,
      email,
      gstin,
      address,
      city,
      state,
      pincode,
      bank_details,
      notes
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Vendor name is required' });
    }

    const result = await query(`
      INSERT INTO vendors (
        name, company_name, contact_person, phone, email, gstin, address, city, state, pincode, bank_details, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name.trim(),
      company_name || null,
      contact_person || null,
      phone || null,
      email || null,
      gstin || null,
      address || null,
      city || null,
      state || null,
      pincode || null,
      bank_details || null,
      notes || null
    ]);

    const newId = result.insertId;
    await logAudit({
      entity_id: newId,
      action: 'vendor_created',
      summary: `Created new vendor "${name.trim()}" (${company_name || 'Individual'})`,
      new_values: req.body
    });

    const createdRows = await query('SELECT * FROM vendors WHERE id = ?', [newId]);
    res.status(201).json(createdRows[0]);
  } catch (err) {
    console.error('Error creating vendor:', err);
    res.status(500).json({ error: 'Failed to create vendor' });
  }
}

// PUT /api/vendors/:id
async function updateVendor(req, res) {
  try {
    const { id } = req.params;
    const existing = await query('SELECT * FROM vendors WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const {
      name,
      company_name,
      contact_person,
      phone,
      email,
      gstin,
      address,
      city,
      state,
      pincode,
      bank_details,
      notes,
      is_active
    } = req.body;

    await query(`
      UPDATE vendors SET
        name = COALESCE(?, name),
        company_name = COALESCE(?, company_name),
        contact_person = COALESCE(?, contact_person),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        gstin = COALESCE(?, gstin),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        state = COALESCE(?, state),
        pincode = COALESCE(?, pincode),
        bank_details = COALESCE(?, bank_details),
        notes = COALESCE(?, notes),
        is_active = COALESCE(?, is_active)
      WHERE id = ?
    `, [
      name !== undefined ? name.trim() : null,
      company_name !== undefined ? company_name : null,
      contact_person !== undefined ? contact_person : null,
      phone !== undefined ? phone : null,
      email !== undefined ? email : null,
      gstin !== undefined ? gstin : null,
      address !== undefined ? address : null,
      city !== undefined ? city : null,
      state !== undefined ? state : null,
      pincode !== undefined ? pincode : null,
      bank_details !== undefined ? bank_details : null,
      notes !== undefined ? notes : null,
      is_active !== undefined ? is_active : null,
      id
    ]);

    await logAudit({
      entity_id: id,
      action: 'vendor_updated',
      summary: `Updated vendor details for "${name || existing[0].name}"`,
      old_values: existing[0],
      new_values: req.body
    });

    const updatedRows = await query('SELECT * FROM vendors WHERE id = ?', [id]);
    res.json(updatedRows[0]);
  } catch (err) {
    console.error('Error updating vendor:', err);
    res.status(500).json({ error: 'Failed to update vendor' });
  }
}

// DELETE /api/vendors/:id
async function deleteVendor(req, res) {
  try {
    const { id } = req.params;
    const existing = await query('SELECT * FROM vendors WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Unlink products before deleting
    await query('UPDATE products SET vendor_id = NULL WHERE vendor_id = ?', [id]);
    await query('DELETE FROM vendors WHERE id = ?', [id]);

    await logAudit({
      entity_id: id,
      action: 'vendor_deleted',
      summary: `Deleted vendor "${existing[0].name}"`,
      old_values: existing[0]
    });

    res.json({ success: true, message: 'Vendor removed successfully' });
  } catch (err) {
    console.error('Error deleting vendor:', err);
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
}

module.exports = {
  getAllVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor
};

