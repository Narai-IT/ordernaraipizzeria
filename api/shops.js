// จัดการร้าน (ผู้ดูแลเท่านั้น)
//   GET               -> รายชื่อร้านทั้งหมด
//   POST { shopNo, code, name, isActive, password?, isNew, originalShopNo? } -> เพิ่ม/แก้ร้าน

import { office } from '../lib/office.js';
import { ok, fail, bodyOf, requireRole, replyError } from '../lib/http.js';

export default async function handler(req, res) {
  if (!requireRole(req, res, 'admin')) return;
  try {
    if (req.method === 'GET') {
      const { shops } = await office('orderShopList');
      return ok(res, { shops });
    }
    if (req.method !== 'POST') return fail(res, 405, 'ใช้ GET หรือ POST');
    const b = bodyOf(req);
    const data = await office('orderShopSave', {
      shopNo: b.shopNo,
      code: b.code,
      name: b.name,
      isActive: b.isActive,
      password: b.password || undefined,
      isNew: Boolean(b.isNew),
      originalShopNo: b.originalShopNo,
    });
    return ok(res, data);
  } catch (e) {
    return replyError(res, e, 'shops');
  }
}
