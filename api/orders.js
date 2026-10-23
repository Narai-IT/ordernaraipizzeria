// ใบเบิกของร้านที่ล็อกอิน — ใช้ API ของ narai-branch ตัวเดียวกับปุ่ม "สั่งของ" ในหน้านับสต๊อก
//   GET                 -> ใบเบิกย้อนหลัง 60 วัน   (/api/pending_orders?outletId=)
//   GET ?no=3498        -> รายการในใบ             (/api/pending_orders?outletId=&no=)
//   POST { deldate, items:[{ code, qty }] }        (/api/insert_order ทีละใบ)
//
// outlet มาจาก token เสมอ — ร้านส่งใบเบิกในนามร้านอื่นไม่ได้แม้จะยิง API ตรง
// ชื่อ/หน่วย/ราคา/itemId อ่านจากทะเบียนสินค้าใหม่ทุกครั้ง ไม่เชื่อค่าที่หน้าเว็บส่งมา

import { office, branchGet, branchPost } from '../lib/office.js';
import { ok, fail, bodyOf, requireRole, replyError } from '../lib/http.js';
import { partitionOrderGroups } from '../public/js/orderGroups.js';

const MAX_DAYS_AHEAD = 30;

/** วันนี้ตามเวลาไทย 'YYYY-MM-DD' (Vercel รันเป็น UTC) */
const bangkokToday = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).slice(0, 10);
const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export function validateDelDate(deldate, today = bangkokToday()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(deldate || ''))) return 'กรุณาเลือกวันที่รับสินค้า';
  if (deldate < today) return 'วันที่รับสินค้าต้องไม่ย้อนหลัง';
  if (deldate > addDays(today, MAX_DAYS_AHEAD)) return `วันที่รับสินค้าล่วงหน้าได้ไม่เกิน ${MAX_DAYS_AHEAD} วัน`;
  return '';
}

/** รายการที่ร้านส่งมา + ทะเบียน -> แถวที่พร้อมส่ง (รวมรหัสซ้ำ, ตัดจำนวน <= 0) */
export function buildLines(requested, registry) {
  const byCode = new Map(registry.map((it) => [String(it.code), it]));
  const qty = new Map();
  const unknown = [];
  for (const r of Array.isArray(requested) ? requested : []) {
    const code = String(r?.code ?? '').trim();
    const q = Number(r?.qty);
    if (!code || !Number.isFinite(q) || q <= 0) continue;
    if (!byCode.has(code)) { unknown.push(code); continue; }
    qty.set(code, Number(((qty.get(code) || 0) + q).toFixed(3)));
  }
  const lines = [...qty].map(([code, q]) => ({ ...byCode.get(code), qty: q }));
  return { lines, unknown };
}

async function submit(req, res, session) {
  const body = bodyOf(req);
  const dateError = validateDelDate(body.deldate);
  if (dateError) return fail(res, 400, dateError);

  // รายการที่ร้านนี้เบิกได้เท่านั้น — ของนอกรายการตกเป็น unknown ไม่ถูกส่ง
  const { items: registry } = await office('orderShopItems', { shopNo: session.shopNo });
  const { lines, unknown } = buildLines(body.items, registry);
  if (unknown.length) {
    return fail(res, 400, `มีสินค้าที่ร้านนี้เบิกไม่ได้ ${unknown.length} รายการ — รีเฟรชหน้าแล้วลองใหม่`, { missing: unknown });
  }
  if (lines.length === 0) return fail(res, 400, 'ยังไม่ได้ใส่จำนวนที่จะเบิก');
  if (lines.length > 500) return fail(res, 400, 'รายการเกิน 500 รายการต่อครั้ง');

  // ส่งทีละใบตามลำดับ — insert_order ล็อกตาราง config ของสาขาตอนจองเลข ยิงพร้อมกันก็ต้องรอคิวกันอยู่ดี
  const results = [];
  for (const g of partitionOrderGroups(lines)) {
    try {
      const r = await branchPost('/api/insert_order', {
        outletId: session.shopNo,
        branch: session.code.toLowerCase(),
        deldate: body.deldate,
        items: g.items.map((it) => ({
          itemId: it.itemId,
          itemCode: it.code,
          itemName: it.name,
          qty: it.qty,
          unit: it.unit,
          price: it.price,
        })),
      });
      results.push({ ok: true, label: g.label, no: r.orderNo, count: r.count, deldate: r.deldate });
    } catch (e) {
      const missing = e.body?.missing;
      results.push({ ok: false, label: g.label, count: g.items.length, message: e.message, missing });
    }
  }
  const okCount = results.filter((r) => r.ok).length;
  const firstError = results.find((r) => !r.ok);
  return res.status(okCount ? 200 : 502).json({
    status: okCount === results.length ? 'success' : okCount ? 'partial' : 'error',
    // ส่งไม่ผ่านเลยสักใบ: ข้อความหลักต้องเป็นเหตุผลจริง ไม่ใช่แค่ "0/1" ที่บอกอะไรไม่ได้
    message: okCount === results.length
      ? `ส่งใบเบิกแล้ว ${okCount} ใบ`
      : okCount ? `ส่งสำเร็จ ${okCount}/${results.length} ใบ` : `ส่งใบเบิกไม่สำเร็จ: ${firstError.message}`,
    results,
  });
}

export default async function handler(req, res) {
  const session = requireRole(req, res, 'shop');
  if (!session) return;
  try {
    if (req.method === 'POST') return await submit(req, res, session);
    if (req.method !== 'GET') return fail(res, 405, 'ใช้ GET หรือ POST');

    if (req.query?.no) {
      const r = await branchGet('/api/pending_orders', { outletId: session.shopNo, no: Number(req.query.no) });
      return ok(res, { no: r.no, items: r.items || [] });
    }
    const r = await branchGet('/api/pending_orders', { outletId: session.shopNo, days: 60 });
    return ok(res, { orders: r.all || [] });
  } catch (e) {
    return replyError(res, e, 'orders');
  }
}
