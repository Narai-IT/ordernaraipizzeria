// ทดสอบ api/* โดยจำลอง office-server และ narai-branch ด้วย fetch ปลอม — ไม่ต้องต่อเครื่องจริง
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.AUTH_SECRET = 'test-secret-0123456789';
process.env.USAGE_API_BASE = 'https://office.test';
process.env.NARAI_BRANCH_URL = 'https://branch.test/';

const { issueToken, verifyToken } = await import('../lib/token.js');
const { buildLines, validateDelDate } = await import('../api/orders.js');
const { partitionOrderGroups } = await import('../public/js/orderGroups.js');
const orders = (await import('../api/orders.js')).default;
const auth = (await import('../api/auth.js')).default;
const shops = (await import('../api/shops.js')).default;

const REGISTRY = [
  { code: '100101', name: 'แป้งพิซซ่า', unit: 'ก้อน', price: 18, itemId: 11, storeCat: 'แป้ง' },
  { code: '100501', name: 'มะเขือเทศสด', unit: 'กก.', price: 45, itemId: 12, storeCat: 'ผัก' },
  { code: '100601', name: 'กล่องพิซซ่า', unit: 'ใบ', price: 9, itemId: 13, storeCat: '' },
];

let calls;
let insertReply;
beforeEach(() => {
  calls = [];
  insertReply = () => ({ status: 200, body: { status: 'success', orderNo: 3500 + calls.length, count: 1, deldate: '2099-01-01' } });
  globalThis.fetch = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url: String(url), body, headers: init.headers || {} });
    let reply;
    if (String(url) === 'https://office.test/schedule') {
      if (body.action === 'orderShopItems') reply = { status: 200, body: { status: 'success', data: { items: REGISTRY, scoped: true } } };
      else if (body.action === 'orderShopLogin') {
        reply = body.password === 'right-pass'
          ? { status: 200, body: { status: 'success', data: { shop: { shopNo: 51, code: 'SUM', name: 'ร้านทดสอบ', isActive: true } } } }
          : { status: 400, body: { status: 'error', message: 'รหัสร้านหรือรหัสผ่านไม่ถูกต้อง' } };
      } else if (body.action === 'storefctLogin') {
        reply = { status: 200, body: { status: 'success', data: { user: { username: 'kai', name: 'ไก่', isAdmin: false } } } };
      } else if (body.action === 'orderShopList') reply = { status: 200, body: { status: 'success', data: { shops: [] } } };
    } else if (String(url) === 'https://branch.test/api/insert_order') reply = insertReply(body);
    reply ||= { status: 404, body: { status: 'error', message: `unexpected ${url}` } };
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  };
});

function mockRes() {
  const res = { statusCode: 200, data: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (d) => { res.data = d; return res; };
  return res;
}
const shopToken = () => issueToken({ role: 'shop', shopNo: 51, code: 'SUM', name: 'ร้านทดสอบ' });

test('token: เซ็นแล้วแก้ payload ไม่ได้ และหมดอายุได้', () => {
  const t = shopToken();
  assert.equal(verifyToken(t).shopNo, 51);
  const [body, sig] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url')), shopNo: 7 })).toString('base64url');
  assert.equal(verifyToken(`${forged}.${sig}`), null);
  assert.equal(verifyToken(t, Date.now() + 13 * 3600 * 1000), null);
});

test('validateDelDate: ห้ามย้อนหลังและเกิน 30 วัน', () => {
  assert.equal(validateDelDate('2026-10-23', '2026-10-23'), '');
  assert.match(validateDelDate('2026-10-22', '2026-10-23'), /ย้อนหลัง/);
  assert.match(validateDelDate('2026-11-23', '2026-10-23'), /30/);
  assert.match(validateDelDate('', '2026-10-23'), /เลือกวันที่/);
});

test('buildLines: รวมรหัสซ้ำ ตัดจำนวน 0 และจับรหัสที่ไม่อยู่ในทะเบียน', () => {
  const { lines, unknown } = buildLines([
    { code: '100101', qty: 10 }, { code: '100101', qty: 5 }, { code: '100601', qty: 0 }, { code: '999', qty: 1 },
  ], REGISTRY);
  assert.deepEqual(lines.map((l) => [l.code, l.qty, l.name]), [['100101', 15, 'แป้งพิซซ่า']]);
  assert.deepEqual(unknown, ['999']);
});

test('partitionOrderGroups: หมวดผักแยกใบ', () => {
  const g = partitionOrderGroups(REGISTRY.map((r) => ({ ...r, qty: 1 })));
  assert.deepEqual(g.map((x) => [x.label, x.items.length]), [['ใบเบิกทั่วไป', 2], ['ใบเบิก ผัก', 1]]);
});

test('POST /api/orders: ส่งในนาม outlet จาก token และใช้ชื่อ/ราคาจากทะเบียน', async () => {
  const req = {
    method: 'POST', headers: { authorization: `Bearer ${shopToken()}` },
    body: { outletId: 7, items: [{ code: '100101', qty: 20, name: 'ปลอม', price: 0 }, { code: '100501', qty: 3 }] },
  };
  const today = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).slice(0, 10);
  req.body.deldate = today;
  const res = mockRes();
  await orders(req, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.data));
  assert.equal(res.data.status, 'success');
  const inserts = calls.filter((c) => c.url.endsWith('/api/insert_order'));
  assert.equal(inserts.length, 2);
  for (const c of inserts) {
    assert.equal(c.body.outletId, 51);
    assert.equal(c.body.branch, 'sum');
  }
  assert.deepEqual(inserts[0].body.items, [{ itemId: 11, itemCode: '100101', itemName: 'แป้งพิซซ่า', qty: 20, unit: 'ก้อน', price: 18 }]);
  assert.equal(inserts[1].body.items[0].itemCode, '100501');
  // office-server ได้รับคำขอทะเบียนของสาขาจาก token
  const reg = calls.find((c) => c.body?.action === 'orderShopItems');
  assert.equal(reg.body.branch, 'SUM');
});

test('POST /api/orders: ใบหนึ่งล้มอีกใบผ่าน = partial พร้อมเหตุผล', async () => {
  let n = 0;
  insertReply = () => (++n === 2
    ? { status: 400, body: { status: 'error', message: 'มี 1 รายการที่ไม่มี itemId', missing: ['100501 มะเขือเทศสด'] } }
    : { status: 200, body: { status: 'success', orderNo: 3600, count: 1, deldate: 'x' } });
  const today = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).slice(0, 10);
  const res = mockRes();
  await orders({ method: 'POST', headers: { authorization: `Bearer ${shopToken()}` },
    body: { deldate: today, items: [{ code: '100101', qty: 1 }, { code: '100501', qty: 1 }] } }, res);
  assert.equal(res.data.status, 'partial');
  assert.equal(res.data.results[0].ok, true);
  assert.equal(res.data.results[1].ok, false);
  assert.deepEqual(res.data.results[1].missing, ['100501 มะเขือเทศสด']);
});

test('ไม่มี token = 401 · ร้านเรียกหน้าผู้ดูแล = 403', async () => {
  const r1 = mockRes();
  await orders({ method: 'GET', headers: {}, query: {} }, r1);
  assert.equal(r1.statusCode, 401);
  const r2 = mockRes();
  await shops({ method: 'GET', headers: { authorization: `Bearer ${shopToken()}` } }, r2);
  assert.equal(r2.statusCode, 403);
  assert.equal(calls.length, 0);
});

test('auth: ร้านล็อกอินได้ token · รหัสผิดได้ 400 · บัญชี storefct ที่ไม่ใช่แอดมินเข้าไม่ได้', async () => {
  const ok = mockRes();
  await auth({ method: 'POST', headers: {}, body: { mode: 'shop', shop: 'SUM', password: 'right-pass' } }, ok);
  assert.equal(ok.statusCode, 200);
  assert.equal(verifyToken(ok.data.token).code, 'SUM');

  const wrong = mockRes();
  await auth({ method: 'POST', headers: {}, body: { mode: 'shop', shop: 'SUM', password: 'nope' } }, wrong);
  assert.equal(wrong.statusCode, 400);
  assert.match(wrong.data.message, /ไม่ถูกต้อง/);

  const notAdmin = mockRes();
  await auth({ method: 'POST', headers: {}, body: { mode: 'admin', username: 'kai', password: 'x' } }, notAdmin);
  assert.equal(notAdmin.statusCode, 403);
});
