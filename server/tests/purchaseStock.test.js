const test = require('node:test');
const assert = require('node:assert/strict');
const {
  itemQuantity,
  itemAppliedQty,
  isLegacyFullyAppliedBill,
  isBillFullyStockApplied,
  computeStockDelta
} = require('../src/utils/purchaseStock');

test('itemQuantity clamps to at least one', () => {
  assert.equal(itemQuantity({ quantity: 0 }), 1);
  assert.equal(itemQuantity({ quantity: '3' }), 3);
  assert.equal(itemQuantity({}), 1);
});

test('itemAppliedQty is clamped between zero and the line quantity', () => {
  assert.equal(itemAppliedQty({ quantity: 3, stock_applied_qty: 2 }), 2);
  assert.equal(itemAppliedQty({ quantity: 3, stock_applied_qty: 9 }), 3);
  assert.equal(itemAppliedQty({ quantity: 3, stock_applied_qty: -4 }), 0);
});

test('computeStockDelta applies only the remaining quantity when stock was pre-applied', () => {
  assert.equal(computeStockDelta({ quantity: 1, stock_applied_qty: 0 }, 1), 1);
  assert.equal(computeStockDelta({ quantity: 1, stock_applied_qty: 1 }, 1), 0);
  assert.equal(computeStockDelta({ quantity: 5, stock_applied_qty: 2 }, 1), 3);
});

test('computeStockDelta reverses only the applied quantity', () => {
  assert.equal(computeStockDelta({ quantity: 3, stock_applied_qty: 2 }, -1), 2);
  assert.equal(computeStockDelta({ quantity: 3, stock_applied_qty: 0 }, -1), 0);
  assert.equal(computeStockDelta({ quantity: 3, stock_applied_qty: 0 }, -1, { legacyFull: true }), 3);
});

test('legacy confirmed bills are treated as fully applied even without per-item data', () => {
  const legacyBill = { stock_applied: 1 };
  const legacyItems = [{ product_id: 'a', quantity: 2, stock_applied_qty: 0 }];
  assert.equal(isLegacyFullyAppliedBill(legacyBill, legacyItems), true);
  assert.equal(isBillFullyStockApplied(legacyBill, legacyItems), true);
});

test('partially applied drafts are not treated as fully applied', () => {
  const bill = { stock_applied: 1 };
  const items = [
    { product_id: 'a', quantity: 1, stock_applied_qty: 1 },
    { product_id: 'b', quantity: 2, stock_applied_qty: 0 }
  ];
  assert.equal(isLegacyFullyAppliedBill(bill, items), false);
  assert.equal(isBillFullyStockApplied(bill, items), false);
});

test('fully applied confirmed bills are detected as complete', () => {
  const bill = { stock_applied: 1 };
  const items = [
    { product_id: 'a', quantity: 1, stock_applied_qty: 1 },
    { product_id: 'b', quantity: 2, stock_applied_qty: 2 }
  ];
  assert.equal(isBillFullyStockApplied(bill, items), true);
});
