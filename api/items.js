// สินค้าที่ร้านเบิกได้ — ทะเบียนเดียวกับหน้านับสต๊อกของ narai-branch (InventoryNarai.dbo.stock_item)
// สาขาเอามาจาก token เสมอ ไม่รับจาก query (ร้านหนึ่งดูทะเบียนของอีกร้านไม่ได้)

import { office } from '../lib/office.js';
import { ok, requireRole, replyError } from '../lib/http.js';

export default async function handler(req, res) {
  const session = requireRole(req, res, 'shop');
  if (!session) return;
  try {
    const { items, scoped } = await office('orderShopItems', { branch: session.code });
    return ok(res, { items, scoped });
  } catch (e) {
    return replyError(res, e, 'items');
  }
}
