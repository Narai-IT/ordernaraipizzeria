// โหมดเดโม — ข้อมูลตัวอย่างในหน่วยความจำ ทำตัวเหมือน /api/* ทุกเส้น (ไม่ได้ต่อฐานข้อมูลจริง)
// รหัสร้าน/outlet เอามาจากทะเบียนสาขาของ narai-branch (lib/branchOutlet.js) ส่วนชื่อร้านเป็นชื่อตัวอย่าง

import { partitionOrderGroups } from './orderGroups.js';
import { bangkokDay } from './ui.js';
import { ApiError } from './api.js';

const PASSWORD = '123456';
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

const shops = [
  [7, 'SJP', 'นาราย พิซเซอเรีย (ชื่อตัวอย่าง)'],
  [12, 'CRM', 'นาราย พิซเซอเรีย (ชื่อตัวอย่าง)'],
  [19, 'XCM', 'นาราย พิซเซอเรีย (ชื่อตัวอย่าง)'],
  [51, 'SUM', 'นาราย พิซเซอเรีย (ชื่อตัวอย่าง)'],
  [55, 'STS', 'นาราย พิซเซอเรีย (ชื่อตัวอย่าง)'],
  [80, 'P90', 'นาราย พิซเซอเรีย (ชื่อตัวอย่าง)'],
  [902, 'HPS', 'นาราย พิซเซอเรีย (ชื่อตัวอย่าง)'],
  [950, 'FCT', 'ครัวกลาง (ชื่อตัวอย่าง)'],
].map(([shopNo, code, name], i) => ({
  shopNo, code, name, isActive: i !== 4, hasPassword: true,
  lastLoginAt: i < 5 ? `${bangkokDay(-i)} ${String(8 + i).padStart(2, '0')}:1${i}:00` : null,
}));
shops[3].name = 'นาราย พิซเซอเรีย สาขาตัวอย่าง';

// [รหัส, ชื่อ, หน่วย, หน่วยเบิก, ราคา, หมวดสโตร์, แพลน]
const items = [
  ['100101', 'แป้งพิซซ่า 12 นิ้ว (ก้อน)', 'ก้อน', 10, 18, 'แป้งและขนมปัง'],
  ['100102', 'แป้งพิซซ่า 9 นิ้ว (ก้อน)', 'ก้อน', 10, 12, 'แป้งและขนมปัง'],
  ['100110', 'ขนมปังกระเทียม', 'แพ็ค', 1, 65, 'แป้งและขนมปัง'],
  ['100201', 'มอซซาเรลล่าชีสขูด', 'กก.', 2, 285, 'ชีสและนม'],
  ['100202', 'พาร์มีซานชีส', 'กก.', 1, 690, 'ชีสและนม'],
  ['100205', 'วิปปิ้งครีม 1 ลิตร', 'กล่อง', 1, 165, 'ชีสและนม'],
  ['100301', 'ซอสมะเขือเทศพิซซ่า', 'กก.', 5, 92, 'ซอสและเครื่องปรุง'],
  ['100302', 'ซอสเพสโต้ใบโหระพา', 'กก.', 1, 420, 'ซอสและเครื่องปรุง'],
  ['100305', 'น้ำมันมะกอก 1 ลิตร', 'ขวด', 1, 310, 'ซอสและเครื่องปรุง'],
  ['100306', 'ออริกาโนแห้ง', 'ถุง', 1, 145, 'ซอสและเครื่องปรุง'],
  ['100401', 'เปปเปอโรนี สไลซ์', 'กก.', 1, 380, 'เนื้อสัตว์'],
  ['100402', 'แฮมสไลซ์', 'กก.', 1, 240, 'เนื้อสัตว์'],
  ['100403', 'ไส้กรอกอิตาเลียน', 'กก.', 1, 295, 'เนื้อสัตว์'],
  ['100405', 'กุ้งแกะเปลือก (แช่แข็ง)', 'กก.', 1, 420, 'เนื้อสัตว์', true],
  ['100501', 'มะเขือเทศสด', 'กก.', 1, 45, 'ผัก'],
  ['100502', 'พริกหวานเขียว', 'กก.', 1, 80, 'ผัก'],
  ['100503', 'หอมใหญ่', 'กก.', 1, 38, 'ผัก'],
  ['100504', 'ใบโหระพาอิตาเลียน', 'กก.', 1, 220, 'ผัก'],
  ['100505', 'เห็ดแชมปิญอง', 'กก.', 1, 150, 'ผัก'],
  ['100506', 'ผักร็อกเก็ต', 'กก.', 1, 260, 'ผัก'],
  ['100601', 'กล่องพิซซ่า 12 นิ้ว', 'ใบ', 50, 9, 'บรรจุภัณฑ์'],
  ['100602', 'กล่องพิซซ่า 9 นิ้ว', 'ใบ', 50, 7, 'บรรจุภัณฑ์'],
  ['100605', 'ถุงหูหิ้วกระดาษ', 'ใบ', 100, 3.5, 'บรรจุภัณฑ์'],
  ['100701', 'น้ำอัดลม 325 มล.', 'ลัง', 1, 330, 'เครื่องดื่ม'],
  ['100702', 'น้ำดื่ม 600 มล.', 'แพ็ค', 1, 62, 'เครื่องดื่ม'],
].map(([code, name, unit, requestUnit, price, storeCat, planOnly = false], i) => ({
  key: code, code, name, unit, requestUnit, price, storeCat, planOnly, itemId: 5000 + i,
}));

const orders = [];
let nextNo = 3480;
(function seed() {
  const pick = (codes, qs) => codes.map((c, i) => ({ ...items.find((it) => it.code === c), qty: qs[i] }));
  const add = (daysAgo, delIn, lines, received) => {
    nextNo += 1;
    orders.push({ shopNo: '*', no: nextNo, orderDate: bangkokDay(-daysAgo), deldate: bangkokDay(-daysAgo + delIn), lines, received });
  };
  add(9, 1, pick(['100101', '100201', '100301', '100601'], [60, 8, 10, 200]), true);
  add(9, 1, pick(['100501', '100503', '100504'], [6, 4, 1]), true);
  add(6, 2, pick(['100101', '100102', '100401', '100402', '100602'], [50, 30, 3, 2, 150]), true);
  add(3, 1, pick(['100201', '100202', '100305', '100306'], [6, 1, 2, 1]), true);
  add(1, 1, pick(['100101', '100301', '100601', '100605', '100701'], [70, 15, 250, 300, 2]), false);
  add(0, 2, pick(['100502', '100505', '100506'], [2, 3, 1]), false);
})();

const issue = (session) => btoa(encodeURIComponent(JSON.stringify(session)));
function sessionOf(token) {
  try { return JSON.parse(decodeURIComponent(atob(token))); } catch { return null; }
}
function need(token, role) {
  const s = sessionOf(token);
  if (!s) throw new ApiError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', 401);
  if (s.role !== role) throw new ApiError('ไม่มีสิทธิ์ใช้หน้านี้', 403);
  return s;
}

export async function login({ mode, shop, username, password }) {
  await wait(400);
  if (mode === 'admin') {
    if (String(username).trim() !== 'admin' || password !== PASSWORD) throw new ApiError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 400);
    const session = { role: 'admin', username: 'admin', name: 'ผู้ดูแลระบบ' };
    return { session, token: issue(session) };
  }
  const v = String(shop || '').trim().toUpperCase();
  const row = shops.find((s) => (/^\d+$/.test(v) ? s.shopNo === Number(v) : s.code === v));
  if (!row || password !== PASSWORD) throw new ApiError('รหัสร้านหรือรหัสผ่านไม่ถูกต้อง', 400);
  if (!row.isActive) throw new ApiError('ร้านนี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ', 400);
  row.lastLoginAt = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' });
  const session = { role: 'shop', shopNo: row.shopNo, code: row.code, name: row.name };
  return { session, token: issue(session) };
}

export async function me(token) {
  const s = sessionOf(token);
  if (!s) throw new ApiError('เซสชันหมดอายุ', 401);
  if (s.role === 'shop') {
    const row = shops.find((x) => x.shopNo === s.shopNo);
    if (!row || !row.isActive) throw new ApiError('ร้านนี้ถูกปิดการใช้งาน', 401);
    const fresh = { role: 'shop', shopNo: row.shopNo, code: row.code, name: row.name };
    return { session: fresh, token: issue(fresh) };
  }
  return { session: s };
}

// รายการที่แต่ละร้านเบิกได้ (แทน dbo.order_shop_item) — ครัวกลาง FCT ยังไม่ได้ตั้ง ไว้ดูหน้าว่าง
const allowed = new Map(shops.map((s) => [s.shopNo, new Set(
  s.code === 'FCT' ? [] : items.filter((it, i) => s.code === 'SUM' || i % 4 !== 3).map((it) => it.code),
)]));
// สินค้าที่ "ผูกกับสาขาในสต๊อกสาขา" (แทน stock_item_branch) ไว้ลองปุ่มเลือกตามสต๊อกสาขา
const inBranch = (code) => Number(code.slice(-1)) % 2 === 1;

async function listItems(token) {
  const s = need(token, 'shop');
  await wait();
  const mine = allowed.get(s.shopNo) || new Set();
  return { items: items.filter((it) => mine.has(it.code)).map((it) => ({ ...it })), configured: mine.size > 0 };
}

async function shopItems(token, shopNo) {
  need(token, 'admin');
  await wait();
  const shop = shops.find((x) => x.shopNo === Number(shopNo));
  if (!shop) throw new ApiError(`ไม่พบร้านรหัส ${shopNo}`, 400);
  const mine = allowed.get(shop.shopNo) || new Set();
  return { shop: { ...shop }, items: items.map((it) => ({ ...it, selected: mine.has(it.code), inBranch: inBranch(it.code) })) };
}

async function setShopItems(token, shopNo, codes) {
  need(token, 'admin');
  await wait(400);
  const shop = shops.find((x) => x.shopNo === Number(shopNo));
  if (!shop) throw new ApiError(`ไม่พบร้านรหัส ${shopNo}`, 400);
  const norm = (c) => String(c ?? '').trim().replace(/\.0+$/, '').replace(/^0+/, '').toLowerCase();
  const byNorm = new Map(items.map((it) => [norm(it.code), it.code]));
  const wanted = [...new Set((codes || []).map(norm).filter(Boolean))];
  const keep = new Set(wanted.map((c) => byNorm.get(c)).filter(Boolean));
  allowed.set(shop.shopNo, keep);
  return { count: keep.size, unknown: wanted.filter((c) => !byNorm.has(c)), message: `บันทึกรายการที่ร้าน ${shop.code} เบิกได้ ${keep.size} รายการ` };
}

async function listOrders(token) {
  const s = need(token, 'shop');
  await wait();
  // ใบตัวอย่าง ('*') ทุกร้านเห็น ส่วนใบที่ส่งในเดโมเห็นเฉพาะร้านที่ส่ง
  const list = orders.filter((o) => o.shopNo === '*' || o.shopNo === s.shopNo)
    .slice().sort((a, b) => b.no - a.no)
    .map((o) => ({
      no: o.no, orderDate: o.orderDate, deldate: o.deldate, itemCount: o.lines.length,
      totalQty: o.lines.reduce((t, l) => t + l.qty, 0), received: o.received,
      status: o.received ? 'รับของแล้ว' : 'รอรับของ',
    }));
  return { orders: list };
}

async function getOrder(token, no) {
  need(token, 'shop');
  await wait(150);
  const o = orders.find((x) => x.no === Number(no));
  return {
    no: Number(no),
    items: (o?.lines || []).map((l, i) => ({
      seq: i + 1, itemId: l.itemId, itemCode: l.code, itemName: l.name, qty: l.qty, unit: l.unit,
      unitPrice: l.price, received: o.received ? l.qty : null,
    })),
  };
}

export async function submit(token, { deldate, items: req }) {
  const s = need(token, 'shop');
  await wait(700);
  if (!deldate) throw new ApiError('กรุณาเลือกวันที่รับสินค้า', 400);
  const mine = allowed.get(s.shopNo) || new Set();
  if ((req || []).some((r) => !mine.has(r.code))) throw new ApiError('มีสินค้าที่ร้านนี้เบิกไม่ได้ — รีเฟรชหน้าแล้วลองใหม่', 400);
  const lines = (req || []).filter((r) => Number(r.qty) > 0)
    .map((r) => ({ ...items.find((it) => it.code === r.code), qty: Number(r.qty) }));
  if (!lines.length) throw new ApiError('ยังไม่ได้ใส่จำนวนที่จะเบิก', 400);
  const results = partitionOrderGroups(lines).map((g) => {
    nextNo += 1;
    orders.push({ shopNo: s.shopNo, no: nextNo, orderDate: bangkokDay(0), deldate, lines: g.items, received: false });
    return { ok: true, label: g.label, no: nextNo, count: g.items.length, deldate };
  });
  return { status: 'success', message: `ส่งใบเบิกแล้ว ${results.length} ใบ`, results };
}

async function listShops(token) {
  need(token, 'admin');
  await wait();
  return { shops: shops.map((x) => ({ ...x, itemCount: allowed.get(x.shopNo)?.size || 0 })) };
}
export { listItems as items, listOrders as orders, getOrder as order, listShops as shops, shopItems, setShopItems };

export async function saveShop(token, b) {
  need(token, 'admin');
  await wait(400);
  const shopNo = Number(b.shopNo);
  const code = String(b.code || '').trim().toUpperCase();
  const name = String(b.name || '').trim();
  if (!Number.isInteger(shopNo) || shopNo <= 0) throw new ApiError('รหัสตัวเลขต้องเป็นจำนวนเต็มบวก', 400);
  if (!/^[A-Z][A-Z0-9]{2}$/.test(code)) throw new ApiError('รหัสสาขาต้องเป็นภาษาอังกฤษ 3 ตัว (ตัวแรกเป็นตัวอักษร เช่น SUM, P90)', 400);
  if (!name) throw new ApiError('กรุณาใส่ชื่ออธิบายร้าน', 400);
  if (b.isNew && !b.password) throw new ApiError('ร้านใหม่ต้องตั้งรหัสผ่าน', 400);
  if (b.password && String(b.password).length < 6) throw new ApiError('รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร', 400);
  const orig = b.isNew ? null : Number(b.originalShopNo ?? shopNo);
  const clash = shops.find((x) => (x.shopNo === shopNo || x.code === code) && x.shopNo !== orig);
  if (clash) throw new ApiError(`รหัสซ้ำกับร้าน ${clash.shopNo} · ${clash.code} ${clash.name}`, 400);
  let row;
  if (b.isNew) {
    row = { shopNo, code, name, isActive: b.isActive !== false, hasPassword: true, lastLoginAt: null };
    shops.push(row);
    allowed.set(shopNo, new Set());
  } else {
    row = shops.find((x) => x.shopNo === orig);
    if (!row) throw new ApiError(`ไม่พบร้านรหัส ${orig}`, 400);
    if (orig !== shopNo) { allowed.set(shopNo, allowed.get(orig) || new Set()); allowed.delete(orig); }
    Object.assign(row, { shopNo, code, name, isActive: b.isActive !== false });
  }
  return { shop: { ...row }, message: `บันทึกร้าน ${code} แล้ว` };
}
