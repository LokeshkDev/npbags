const test = require('node:test');
const assert = require('node:assert/strict');
const { stockChangesForItems } = require('../src/controllers/purchaseBillController');

function deltaOf(item, confirm, defaultScanFromApplied = false) {
  const [change] = stockChangesForItems([{ product_id: 'p', ...item }], confirm, defaultScanFromApplied);
  return change.delta;
}

test('confirmed create applies only the remaining quantity after an immediate scan', () => {
  assert.equal(deltaOf({ quantity: 3, stock_applied_qty: 1, stock_scan_applied: 1 }, true), 2);
});

test('draft create adds nothing because the scanned stock is already applied', () => {
  assert.equal(deltaOf({ quantity: 3, stock_applied_qty: 1, stock_scan_applied: 1 }, false), 0);
});

test('editing an existing draft re-applies its persisted applied stock after reversal', () => {
  assert.equal(deltaOf({ quantity: 5, stock_applied_qty: 2, stock_scan_applied: 0 }, false), 2);
});

test('confirming an edited draft applies the full quantity after reversal', () => {
  assert.equal(deltaOf({ quantity: 5, stock_applied_qty: 2, stock_scan_applied: 0 }, true), 5);
});

test('a newly scanned item during a confirmed edit only applies the remaining quantity', () => {
  assert.equal(deltaOf({ quantity: 5, stock_applied_qty: 2, stock_scan_applied: 2 }, true), 3);
});

test('unconfirmed edits remove stock that is not meant to stay applied', () => {
  assert.equal(deltaOf({ quantity: 2, stock_applied_qty: 0, stock_scan_applied: 0 }, false), 0);
  assert.equal(deltaOf({ quantity: 2, stock_applied_qty: 1, stock_scan_applied: 1 }, false), 0);
});

test('manual items without any scan application are fully applied on confirmation', () => {
  assert.equal(deltaOf({ quantity: 4, stock_applied_qty: 0, stock_scan_applied: 0 }, true), 4);
});

test('scan quantities are clamped to the line quantity', () => {
  assert.equal(deltaOf({ quantity: 2, stock_applied_qty: 5, stock_scan_applied: 9 }, false), 0);
  assert.equal(deltaOf({ quantity: 2, stock_applied_qty: 5, stock_scan_applied: 9 }, true), 0);
});

test('create falls back to applied quantity when the scan marker is missing', () => {
  assert.equal(deltaOf({ quantity: 3, stock_applied_qty: 1 }, true, true), 2);
  assert.equal(deltaOf({ quantity: 3, stock_applied_qty: 1 }, false, true), 0);
});
