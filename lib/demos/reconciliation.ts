/** Synthetic, browser-only three-way-match demonstration. All money is integer paise.
 * There is no Tally/network adapter, OCR, production policy or accounting authority here.
 */
export const DEMO_CASE_ID = 'b7719635-8f9d-4d4c-9a36-f8588b013c99';
export const DEMO_POLICY = { priceToleranceBps: 50, label: 'Illustrative policy · 0.50% price tolerance · exact quantity, unit and tax' };
export type Line = { sku: string; description: string; unit: string; quantity: number; price: number; taxBps: number };
export type Invoice = { id: string; reference: string; supplier: string; supplierId: string; company: string; period: string; po: string; received: string; lines: Line[]; duplicateOf?: string };
export type PurchaseOrder = { reference: string; supplierId: string; company: string; lines: Line[] };
export type Receipt = { reference: string; po: string; sku: string; unit: string; quantity: number; supplierId: string; company: string };
export type Finding = { field: string; message: string; owner: string; severity: 'hold' | 'wait' };
export type Match = { status: 'ready' | 'exception' | 'waiting' | 'duplicate'; findings: Finding[]; matched: number; total: number; priceVariance: number };
export type Audit = { sequence: number; at: string; invoiceId: string; action: string; detail: string };
export type Approval = { fingerprint: string; actor: string; at: string };
export type Voucher = { reference: string; key: string; fingerprint: string; total: number; verified: boolean };
export type DemoState = { invoices: Invoice[]; orders: PurchaseOrder[]; receipts: Receipt[]; approvals: Record<string, Approval>; vouchers: Record<string, Voucher>; checked: string[]; audit: Audit[] };
const line = (sku: string, description: string, quantity: number, rupees: number, taxBps = 1800, unit = 'each'): Line => ({ sku, description, quantity, price: rupees * 100, taxBps, unit });
export function createDemo(): DemoState {
  const definitions = [
    { id: '1042', vendor: 'Atlas Network Supply', supplierId: 'DEMO-ATLAS', po: 'PO-26071', item: line('SW-24P', '24-port managed switch', 10, 20000) },
    { id: '1043', vendor: 'Cobalt IT Distribution', supplierId: 'DEMO-COBALT', po: 'PO-26072', item: line('AP-AX6', 'Wi-Fi access point', 6, 18000) },
    { id: '1044', vendor: 'Vertex Systems Supply', supplierId: 'DEMO-VERTEX', po: 'PO-26073', item: line('UPS-1K', '1 kVA online UPS', 10, 12000) },
    { id: '1045', vendor: 'Atlas Network Supply', supplierId: 'DEMO-ATLAS', po: 'PO-26071', item: line('SW-24P', '24-port managed switch', 10, 20000) },
    { id: '1046', vendor: 'Orbit Infrastructure', supplierId: 'DEMO-ORBIT', po: 'PO-26999', item: line('SSD-1T', 'Enterprise solid-state drive', 8, 8500) },
    { id: '1047', vendor: 'Northstar Components', supplierId: 'DEMO-NORTHSTAR', po: 'PO-26075', item: line('RAM-32', '32 GB server memory', 12, 6500, 1200) },
    { id: '1048', vendor: 'Meridian Connect', supplierId: 'DEMO-MERIDIAN', po: 'PO-26076', item: line('CB-C6', 'Category 6 patch cable', 20, 450, 1800, 'box') },
  ];
  const invoices: Invoice[] = definitions.map(d => ({ id: d.id, reference: `INV-${d.id === '1045' ? '1042' : d.id}`, supplier: d.vendor, supplierId: d.supplierId, po: d.po, company: 'Pentagon · demo company', period: '2026–27', received: '17 Oct 2026', lines: [{ ...d.item }], ...(d.id === '1045' ? { duplicateOf: '1042' } : {}) }));
  const orders: PurchaseOrder[] = definitions.filter(d => !['1045', '1046'].includes(d.id)).map(d => ({ reference: d.po, supplierId: d.supplierId, company: 'Pentagon · demo company', lines: [{ ...d.item, price: d.id === '1043' ? 1750000 : d.item.price, taxBps: 1800, unit: 'each' }] }));
  const receipts = orders.flatMap((o, i) => o.lines.map(l => ({ reference: `GRN-${3101 + i}`, po: o.reference, sku: l.sku, unit: l.unit, quantity: o.reference === 'PO-26073' ? 6 : l.quantity, supplierId: o.supplierId, company: o.company })));
  return { invoices, orders, receipts, approvals: {}, vouchers: {}, checked: [], audit: [] };
}
export function invoiceKey(i: Invoice): string { return [i.company, i.supplierId, i.period, i.reference.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase()].join('|'); }
export function total(i: Invoice): number { return i.lines.reduce((sum, l) => sum + l.quantity * l.price + Math.round(l.quantity * l.price * l.taxBps / 10000), 0); }
export function money(paise: number): string { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100); }
export function invoice(state: DemoState, id: string): Invoice { const found = state.invoices.find(i => i.id === id); if (!found) throw Error('Invoice not found'); return found; }
export function receivedQuantity(state: DemoState, i: Invoice, l: Line): number { return state.receipts.filter(r => r.po === i.po && r.sku === l.sku && r.unit === l.unit && r.company === i.company && r.supplierId === i.supplierId).reduce((sum, r) => sum + r.quantity, 0); }
export function matchInvoice(state: DemoState, id: string): Match {
  const i = invoice(state, id), key = invoiceKey(i), canonical = state.invoices.find(other => invoiceKey(other) === key);
  const findings: Finding[] = []; let matched = 0, priceVariance = 0;
  const hold = (field: string, message: string, owner = 'Finance') => findings.push({ field, message, owner, severity: 'hold' });
  if (canonical?.id !== id) return { status: 'duplicate', findings: [{ field: 'Invoice identity', message: `${i.reference} already exists for this supplier, company and financial year. Review the original record; this copy cannot be posted.`, owner: 'Finance', severity: 'hold' }], matched, total: total(i), priceVariance };
  const po = state.orders.find(p => p.reference === i.po && p.company === i.company);
  if (!po) hold('Purchase order', `No purchase order ${i.po} is available in the demo company.`, 'Procurement');
  else {
    if (po.supplierId !== i.supplierId) hold('Supplier', 'Invoice supplier does not match the purchase order supplier.', 'Procurement');
    if (!i.lines.length) hold('Invoice lines', 'Invoice has no line items.');
    const seen = new Set<string>();
    for (const l of i.lines) {
      const before = findings.length, p = po.lines.find(p => p.sku === l.sku);
      if (seen.has(l.sku)) hold('Item', `Repeated item ${l.sku} needs allocation before matching.`); seen.add(l.sku);
      if (!Number.isSafeInteger(l.quantity) || l.quantity <= 0 || !Number.isSafeInteger(l.price) || l.price <= 0 || !Number.isSafeInteger(l.taxBps) || l.taxBps < 0) { hold('Line data', 'Quantity, price and tax must be valid positive sample values.'); continue; }
      if (!p) { hold('Item', `${l.sku} is not on the purchase order.`, 'Procurement'); continue; }
      if (l.unit !== p.unit) hold('Unit', `Invoice uses ${l.unit}; purchase order uses ${p.unit}. An approved conversion is required.`, 'Procurement');
      priceVariance += (l.price - p.price) * l.quantity;
      if (Math.abs(l.price - p.price) * 10000 > p.price * DEMO_POLICY.priceToleranceBps) hold('Unit price', `${money(l.price)} invoiced vs ${money(p.price)} ordered. Outside the illustrative 0.50% tolerance.`, 'Procurement');
      if (l.taxBps !== p.taxBps) hold('Tax', `${l.taxBps / 100}% invoiced vs ${p.taxBps / 100}% on the purchase order. Finance must resolve the tax basis.`);
      const used = state.invoices.filter(other => other.id !== id && other.po === i.po && other.company === i.company && other.supplierId === i.supplierId && state.vouchers[other.id]).flatMap(other => other.lines).filter(other => other.sku === l.sku && other.unit === l.unit).reduce((sum, other) => sum + other.quantity, 0);
      if (l.quantity + used > p.quantity) hold('Ordered quantity', `Invoice quantity exceeds the remaining purchase order balance of ${Math.max(0, p.quantity - used)}.`, 'Procurement');
      const received = Math.max(0, receivedQuantity(state, i, l) - used);
      if (l.unit === p.unit && l.quantity > received) findings.push({ field: 'Received quantity', message: `${received} of ${l.quantity} ${l.unit} available. Waiting for ${l.quantity - received} more; the same invoice will be rechecked.`, owner: 'Stores', severity: 'wait' });
      if (findings.length === before) matched++;
    }
  }
  return { status: findings.some(f => f.severity === 'hold') ? 'exception' : findings.length ? 'waiting' : 'ready', findings, matched, total: total(i), priceVariance };
}
// An exact canonical payload binds the simulation's approval; this is not a security hash.
export function fingerprint(state: DemoState, id: string): string { const i = invoice(state, id); return JSON.stringify({ invoice: i, order: state.orders.find(p => p.reference === i.po && p.company === i.company), receipts: state.receipts.filter(r => r.po === i.po && r.company === i.company), policy: DEMO_POLICY }); }
function log(state: DemoState, id: string, action: string, detail: string): void { state.audit.push({ sequence: state.audit.length + 1, at: new Date().toISOString(), invoiceId: id, action, detail }); }
export function runMatching(state: DemoState): DemoState { const next = structuredClone(state); next.checked = next.invoices.map(i => i.id); log(next, 'batch', 'Matching completed', 'Seven sample invoices checked against purchase orders, receipts, duplicate identities and illustrative policy.'); return next; }
export function addLateReceipt(state: DemoState): DemoState {
  if (state.receipts.some(r => r.reference === 'GRN-3103-B')) return state;
  const next = structuredClone(state), i = invoice(next, '1044');
  next.receipts.push({ reference: 'GRN-3103-B', po: i.po, sku: 'UPS-1K', unit: 'each', quantity: 4, supplierId: i.supplierId, company: i.company });
  delete next.approvals[i.id]; log(next, i.id, 'Receipt received · rechecked', 'GRN-3103-B adds four units. Same invoice retained; receipt replay is ignored.'); return next;
}
export function approveInvoice(state: DemoState, id: string): DemoState {
  if (!state.checked.includes(id)) throw Error('Run matching before approval.');
  if (matchInvoice(state, id).status !== 'ready') throw Error('Resolve every exception before approval.');
  if (state.vouchers[id]) return state;
  const fp = fingerprint(state, id); if (state.approvals[id]?.fingerprint === fp) return state;
  const next = structuredClone(state); next.approvals[id] = { fingerprint: fp, actor: 'Finance reviewer · demo role', at: new Date().toISOString() };
  log(next, id, 'Demo approval recorded', 'Finance review bound to the current invoice, order, receipts and matching policy.'); return next;
}
export function postInvoice(state: DemoState, id: string, simulateTimeout = false): DemoState {
  const fp = fingerprint(state, id), i = invoice(state, id), existing = state.vouchers[id];
  if (existing) { if (existing.fingerprint !== fp) throw Error('Posted evidence changed. Reconcile the existing voucher; do not repost.'); return state; }
  if (matchInvoice(state, id).status !== 'ready' || state.approvals[id]?.fingerprint !== fp) throw Error('A current approval and a clean match are required.');
  if (Object.values(state.vouchers).some(v => v.key === invoiceKey(i))) throw Error('A voucher already exists for this invoice.');
  const next = structuredClone(state), reference = `SIM-PUR-${String(Object.keys(next.vouchers).length + 1).padStart(4, '0')}`;
  next.vouchers[id] = { reference, key: invoiceKey(i), fingerprint: fp, total: total(i), verified: !simulateTimeout };
  log(next, id, simulateTimeout ? 'Simulated response timeout' : 'Simulated voucher verified', simulateTimeout ? 'A simulated voucher exists but the response was lost. Read-back is required before another action.' : `${reference} matches the approved payload. No live Tally write was made.`); return next;
}
export function reconcileVoucher(state: DemoState, id: string): DemoState {
  const current = state.vouchers[id]; if (!current) throw Error('No simulated voucher is available to reconcile.');
  if (current.fingerprint !== fingerprint(state, id)) throw Error('Voucher differs from current evidence. Accounting correction is required.');
  if (current.verified) return state;
  const next = structuredClone(state); next.vouchers[id].verified = true; log(next, id, 'Read-back verified', `${current.reference} found with the same approved payload. No second voucher created.`); return next;
}
export function auditCsv(state: DemoState): string { const cell = (s: string) => '"' + (/^[=+@\-\t\r]/.test(s) ? "'" : '') + s.replaceAll('"', '""') + '"'; return ['Sequence,Time,Invoice,Action,Detail', ...state.audit.map(a => [String(a.sequence), a.at, a.invoiceId, a.action, a.detail].map(cell).join(','))].join('\r\n'); }
