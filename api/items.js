// สินค้าที่ร้านเบิกได้ — ทะเบียนเดียวกับหน้านับสต๊อกของ narai-branch (InventoryNarai.dbo.stock_item)
// เฉพาะที่ผู้ดูแลตั้งให้ร้านนี้ + ที่ติ๊กสาขานี้ไว้ในหน้าวัตถุดิบของ office (ดู lib/shopItems.js)
// ร้านเอามาจาก token เสมอ ไม่รับจาก query

import { shopAllowedItems } from '../lib/shopItems.js';
import { ok, requireRole, replyError } from '../lib/http.js';

export default async function handler(req, res) {
  const session = requireRole(req, res, 'shop');
  if (!session) return;
  try {
    const { items, configured } = await shopAllowedItems(session.shopNo);
    return ok(res, { items, configured });
  } catch (e) {
    return replyError(res, e, 'items');
  }
}
