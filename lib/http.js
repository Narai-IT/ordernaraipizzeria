// ตัวช่วยของ api/* — วางไว้นอก api/ เพราะทุกไฟล์ใน api/ ถูกนับเป็น Serverless Function

import { sessionFrom } from './token.js';

export const ok = (res, data = {}) => res.status(200).json({ status: 'success', ...data });
export const fail = (res, code, message, extra = {}) => res.status(code).json({ status: 'error', message, ...extra });

/** body เป็น object เสมอ (Vercel ให้ string มาบ้างถ้า content-type ไม่ใช่ JSON) */
export function bodyOf(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body || '{}');
  } catch {
    return {};
  }
}

/**
 * ต้องล็อกอินด้วยบทบาทที่กำหนด — ไม่ผ่านตอบ 401/403 ให้เองแล้วคืน null
 * @param {'shop'|'admin'} role
 */
export function requireRole(req, res, role) {
  const session = sessionFrom(req);
  if (!session) {
    fail(res, 401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    return null;
  }
  if (session.role !== role) {
    fail(res, 403, role === 'admin' ? 'หน้านี้สำหรับผู้ดูแลระบบเท่านั้น' : 'หน้านี้สำหรับร้านที่ล็อกอินเท่านั้น');
    return null;
  }
  return session;
}

/** error จากชั้นล่าง -> คำตอบ (status ที่ติดมากับ error ใช้ตามนั้น) */
export function replyError(res, error, context) {
  const code = Number(error?.status) || 502;
  if (code >= 500) console.error(`${context}:`, error);
  return fail(res, code, error?.message || 'เกิดข้อผิดพลาด');
}
