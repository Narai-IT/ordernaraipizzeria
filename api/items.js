// สินค้าที่ร้านเบิกได้ — ทะเบียนเดียวกับหน้านับสต๊อกของ narai-branch (InventoryNarai.dbo.stock_item)
// เฉพาะสินค้าที่ผู้ดูแลตั้งให้ร้านนี้เบิกได้ (dbo.order_shop_item) — ร้านเอามาจาก token เสมอ ไม่รับจาก query

import { office } from '../lib/office.js';
import { ok, requireRole, replyError } from '../lib/http.js';

export default async function handler(req, res) {
  const session = requireRole(req, res, 'shop');
  if (!session) return;
  try {
    const { items, configured } = await office('orderShopItems', { shopNo: session.shopNo });
    return ok(res, { items, configured });
  } catch (e) {
    return replyError(res, e, 'items');
  }
}
