// ล็อกอิน — สองแบบ
//   ร้าน:      POST { mode:'shop',  shop:'SUM' | '51', password }  -> office-server orderShopLogin
//   ผู้ดูแล:    POST { mode:'admin', username, password }           -> office-server storefctLogin (บัญชีแอดมินของ storefct)
//   ตรวจซ้ำ:   GET  (Authorization: Bearer <token>)                -> ร้านที่ถูกปิดระหว่างวันจะเด้งออกที่นี่

import { office } from '../lib/office.js';
import { issueToken, sessionFrom } from '../lib/token.js';
import { ok, fail, bodyOf, replyError } from '../lib/http.js';

const shopSession = (s) => ({ role: 'shop', shopNo: s.shopNo, code: s.code, name: s.name });

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const session = sessionFrom(req);
      if (!session) return fail(res, 401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      if (session.role === 'shop') {
        const { shop } = await office('orderShopGet', { shopNo: session.shopNo });
        if (!shop) return fail(res, 401, 'ร้านนี้ถูกปิดการใช้งานหรือถูกลบ กรุณาติดต่อผู้ดูแลระบบ');
        // ชื่อ/รหัสร้านที่แอดมินแก้ระหว่างวันมีผลทันทีโดยไม่ต้องล็อกอินใหม่
        const fresh = shopSession(shop);
        return ok(res, { session: fresh, token: issueToken(fresh) });
      }
      return ok(res, { session });
    }

    if (req.method !== 'POST') return fail(res, 405, 'ใช้ POST เพื่อเข้าสู่ระบบ');
    const body = bodyOf(req);

    if (body.mode === 'admin') {
      const { user } = await office('storefctLogin', { username: body.username, password: body.password });
      if (!user?.isAdmin) return fail(res, 403, 'บัญชีนี้ไม่ใช่ผู้ดูแลระบบ');
      const session = { role: 'admin', username: user.username, name: user.name || user.username };
      return ok(res, { session, token: issueToken(session) });
    }

    const { shop } = await office('orderShopLogin', { shop: body.shop, password: body.password });
    const session = shopSession(shop);
    return ok(res, { session, token: issueToken(session) });
  } catch (e) {
    return replyError(res, e, 'auth');
  }
}
