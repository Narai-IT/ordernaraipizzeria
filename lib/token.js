// token ล็อกอิน — JSON ที่เซ็นด้วย HMAC-SHA256 (ไม่ต้องพึ่ง library ภายนอก)
//
// ทำไมต้องเซ็น: ร้านถูกล็อกไว้กับ outlet ของตัวเอง ถ้าเชื่อค่าที่เบราว์เซอร์ส่งมาเฉย ๆ
// ใครก็แก้ localStorage แล้วส่งใบเบิกในนามร้านอื่นได้ — token ที่เซ็นแล้วแก้ไม่ได้โดยไม่รู้ AUTH_SECRET
//
// รูปแบบ: <payload base64url>.<signature base64url>

import { createHmac, timingSafeEqual } from 'node:crypto';

const TTL_SEC = 12 * 60 * 60; // 12 ชั่วโมง — พอสำหรับหนึ่งกะ ไม่ต้องล็อกอินใหม่กลางวัน

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error('ยังไม่ได้ตั้ง AUTH_SECRET (อย่างน้อย 16 ตัวอักษร) ใน env ของ Vercel');
  return s;
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data) => b64(createHmac('sha256', secret()).update(data).digest());

/** ออก token — payload ต้องมี role ('shop' | 'admin') */
export function issueToken(payload, now = Date.now()) {
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(now / 1000) + TTL_SEC }));
  return `${body}.${sign(body)}`;
}

/** ตรวจ token — ผิด/หมดอายุคืน null */
export function verifyToken(token, now = Date.now()) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expect = Buffer.from(sign(body));
  const got = Buffer.from(sig);
  if (expect.length !== got.length || !timingSafeEqual(expect, got)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!data.exp || data.exp * 1000 < now) return null;
    return data;
  } catch {
    return null;
  }
}

/** อ่าน token จาก header Authorization: Bearer ... */
export function sessionFrom(req) {
  const h = String(req.headers?.authorization || '');
  return h.startsWith('Bearer ') ? verifyToken(h.slice(7)) : null;
}
