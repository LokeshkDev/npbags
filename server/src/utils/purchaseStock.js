function itemQuantity(item = {}) {
  return Math.max(1, parseInt(item.quantity, 10) || 1);
}

function itemAppliedQty(item = {}) {
  const quantity = itemQuantity(item);
  const applied = parseInt(item.stock_applied_qty, 10) || 0;
  return Math.min(quantity, Math.max(0, applied));
}

function isLegacyFullyAppliedBill(bill, items) {
  if (Number(bill && bill.stock_applied) !== 1) return false;
  return (items || []).every(item => !item.product_id || itemAppliedQty(item) === 0);
}

function isBillFullyStockApplied(bill, items) {
  if (Number(bill && bill.stock_applied) !== 1) return false;
  if (isLegacyFullyAppliedBill(bill, items)) return true;
  return (items || []).every(item => !item.product_id || itemAppliedQty(item) >= itemQuantity(item));
}

function computeStockDelta(item, direction, options = {}) {
  const quantity = itemQuantity(item);
  const applied = itemAppliedQty(item);
  if (direction > 0) return Math.max(0, quantity - applied);
  if (applied > 0) return applied;
  return options.legacyFull ? quantity : 0;
}

module.exports = {
  itemQuantity,
  itemAppliedQty,
  isLegacyFullyAppliedBill,
  isBillFullyStockApplied,
  computeStockDelta
};
