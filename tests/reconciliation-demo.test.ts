import assert from 'node:assert/strict';
import test from 'node:test';
import { addLateReceipt, approveInvoice, auditCsv, createDemo, invoiceKey, matchInvoice, postInvoice, reconcileVoucher, runMatching, total } from '../lib/demos/reconciliation';

test('sample batch contains one clean match and six specific controlled exceptions', () => {
  const s = createDemo();
  assert.deepEqual(s.invoices.map(i => matchInvoice(s, i.id).status), ['ready', 'exception', 'waiting', 'duplicate', 'exception', 'exception', 'exception']);
  assert.equal(total(s.invoices[0]), 23600000);
  assert.equal(matchInvoice(s, '1043').priceVariance, 300000);
  assert.match(matchInvoice(s, '1047').findings[0].message, /12% invoiced vs 18%/);
  assert.ok(matchInvoice(s, '1048').findings.some(f => f.field === 'Unit'));
});
test('price tolerance accepts the exact boundary and rejects one paise beyond', () => {
  const s = createDemo(); s.invoices[0].lines[0].price = 2010000;
  assert.equal(matchInvoice(s, '1042').status, 'ready');
  s.invoices[0].lines[0].price++; assert.equal(matchInvoice(s, '1042').status, 'exception');
});
test('late receipt resumes the same invoice and replay does not increase received quantity', () => {
  const s = runMatching(createDemo()), next = addLateReceipt(s), replay = addLateReceipt(next);
  assert.equal(matchInvoice(next, '1044').status, 'ready'); assert.equal(next.invoices.length, s.invoices.length);
  assert.equal(replay, next); assert.equal(next.receipts.length, s.receipts.length + 1); assert.equal(s.receipts.length, 5);
});
test('posting requires matching and an explicit current approval', () => {
  const s = createDemo(); assert.throws(() => approveInvoice(s, '1042'), /Run matching/);
  assert.throws(() => postInvoice(runMatching(s), '1042'), /approval/);
  for (const id of ['1043', '1044', '1045', '1046', '1047', '1048']) assert.throws(() => approveInvoice(runMatching(s), id), /exception/);
});
test('a price change invalidates an existing approval even when inside tolerance', () => {
  const s = approveInvoice(runMatching(createDemo()), '1042'); s.invoices[0].lines[0].price++;
  assert.equal(matchInvoice(s, '1042').status, 'ready'); assert.throws(() => postInvoice(s, '1042'), /current approval/);
});
test('receipt evidence changes invalidate approval', () => {
  const s = approveInvoice(runMatching(createDemo()), '1042'); s.receipts[0].reference = 'CORRECTED-RECEIPT';
  assert.throws(() => postInvoice(s, '1042'), /current approval/);
});
test('simulated timeout reconciles a single voucher and never posts twice', () => {
  const s = approveInvoice(runMatching(createDemo()), '1042'), posted = postInvoice(s, '1042', true);
  assert.equal(posted.vouchers['1042'].verified, false); assert.equal(postInvoice(posted, '1042'), posted);
  const verified = reconcileVoucher(posted, '1042'); assert.equal(verified.vouchers['1042'].verified, true);
  assert.equal(Object.keys(verified.vouchers).length, 1); assert.equal(reconcileVoucher(verified, '1042'), verified);
  assert.equal(s.vouchers['1042'], undefined);
});
test('changed evidence on a posted invoice is held for accounting reconciliation', () => {
  const s = postInvoice(approveInvoice(runMatching(createDemo()), '1042'), '1042'); s.invoices[0].lines[0].quantity--;
  assert.throws(() => postInvoice(s, '1042'), /evidence changed/);
  assert.throws(() => reconcileVoucher(s, '1042'), /Accounting correction/);
});
test('duplicates use normalized supplier, invoice, company and financial year identity', () => {
  const s = createDemo(); s.invoices[3].reference = ' inv / 1042 ';
  assert.equal(invoiceKey(s.invoices[0]), invoiceKey(s.invoices[3])); assert.equal(matchInvoice(s, '1045').status, 'duplicate');
  s.invoices[3].period = '2027–28'; assert.notEqual(invoiceKey(s.invoices[0]), invoiceKey(s.invoices[3]));
});
test('a second invoice cannot consume quantities already posted against an order', () => {
  let s = runMatching(createDemo()); s.invoices[0].lines[0].quantity = 6;
  s = postInvoice(approveInvoice(s, '1042'), '1042');
  s.invoices[3].reference = 'INV-NEW'; s.invoices[3].lines[0].quantity = 4;
  assert.equal(matchInvoice(s, '1045').status, 'ready');
  s.invoices[3].lines[0].quantity = 5;
  assert.ok(matchInvoice(s, '1045').findings.some(f => f.field === 'Ordered quantity'));
  assert.ok(matchInvoice(s, '1045').findings.some(f => f.field === 'Received quantity'));
});
test('foreign supplier receipts and invalid lines never silently pass', () => {
  const s = createDemo(); s.receipts[0].supplierId = 'ANOTHER-SUPPLIER'; assert.equal(matchInvoice(s, '1042').status, 'waiting');
  s.invoices[0].lines[0].quantity = -1; assert.equal(matchInvoice(s, '1042').status, 'exception');
  s.invoices[0].lines = []; assert.equal(matchInvoice(s, '1042').status, 'exception');
});
test('audit exports safely quote cells and neutralize spreadsheet formulas', () => {
  const s = runMatching(createDemo()); s.audit[0].detail = '=HYPERLINK("x")';
  assert.ok(auditCsv(s).includes('"\'=HYPERLINK(""x"")"')); assert.ok(auditCsv(s).startsWith('Sequence,Time,Invoice,Action,Detail\r\n'));
});
