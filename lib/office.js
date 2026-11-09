// ต่อระบบหลังบ้านตัวเดียวกับ narai-branch — ไม่มีฐานข้อมูล/เซิร์ฟเวอร์ของตัวเอง
//
//   office-server (POST /schedule)  -> SQL Server InventoryNarai  ทะเบียนร้าน / ล็อกอิน / ทะเบียนสินค้า
//   narai-branch (/api/insert_order, /api/pending_orders) -> MySQL myfbdata (POS)  ตัวใบเบิกจริง
//
// Vercel ต่อ SQL Server ตรงไม่ได้ (ไฟร์วอลล์เปิดพอร์ต 1433 ให้เฉพาะ IP ในไทย) จึงเดินผ่าน office-server
// เหมือนที่ narai-branch และ storefct ทำ — ใช้ USAGE_API_BASE / USAGE_API_TOKEN ชุดเดียวกัน

const OFFICE_BASE = () => process.env.USAGE_API_BASE || 'https://usage.khanoykorshabu.com';
const BRANCH_BASE = () => {
  const b = process.env.NARAI_BRANCH_URL;
  if (!b) throw Object.assign(new Error('ยังไม่ได้ตั้ง NARAI_BRANCH_URL (ที่อยู่เว็บ narai-branch) ใน env ของ Vercel'), { status: 500 });
  return b.replace(/\/+$/, '');
};

// fetch ของ Node บอกแค่ "fetch failed" — เหตุผลจริงอยู่ใน e.cause (ENOTFOUND / ECONNREFUSED / ใบรับรอง SSL ...)
const CAUSE_HINTS = {
  ENOTFOUND: 'หาโดเมนไม่เจอ — ตรวจที่อยู่ใน env ว่าสะกดถูก',
  EAI_AGAIN: 'หาโดเมนไม่เจอชั่วคราว (DNS)',
  ECONNREFUSED: 'เครื่องปลายทางไม่รับการเชื่อมต่อ — เซิร์ฟเวอร์ปิดอยู่หรือพอร์ตผิด',
  ECONNRESET: 'ปลายทางตัดการเชื่อมต่อ',
  ETIMEDOUT: 'ต่อไม่ติดภายในเวลา — ไฟร์วอลล์อาจบล็อกอยู่',
  UND_ERR_CONNECT_TIMEOUT: 'ต่อไม่ติดภายในเวลา — ไฟร์วอลล์อาจบล็อกอยู่',
  CERT_HAS_EXPIRED: 'ใบรับรอง SSL ของปลายทางหมดอายุ',
  ERR_TLS_CERT_ALTNAME_INVALID: 'ใบรับรอง SSL ไม่ตรงกับโดเมน',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'ปลายทางใช้ใบรับรอง SSL แบบ self-signed',
  SELF_SIGNED_CERT_IN_CHAIN: 'ปลายทางใช้ใบรับรอง SSL แบบ self-signed',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'ใบรับรอง SSL ของปลายทางไม่ครบ chain',
  EPROTO: 'คุย SSL ไม่ได้ — ปลายทางอาจเปิดแค่ http ไม่ใช่ https',
};

export function describeFetchError(e, url) {
  let cause = e?.cause;
  if (cause?.errors?.length) cause = cause.errors[0]; // AggregateError (ลองหลาย IP แล้วไม่ผ่านสักตัว)
  const code = cause?.code || e?.code;
  let host = '';
  try { host = new URL(url).host; } catch { /* url เพี้ยน — ข้อความของ e บอกอยู่แล้ว */ }
  const parts = [code ? `${code}${CAUSE_HINTS[code] ? ` ${CAUSE_HINTS[code]}` : ''}` : cause?.message || e?.message];
  if (host) parts.push(host);
  return parts.filter(Boolean).join(' · ');
}

async function fetchJson(url, init, timeoutMs, what) {
  let r;
  try {
    r = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const timeout = e?.name === 'TimeoutError';
    if (!timeout) console.error(`[fetch] ${url}`, e?.cause || e);
    throw Object.assign(new Error(timeout ? `${what}ตอบช้าเกินไป ลองใหม่อีกครั้ง` : `ติดต่อ${what}ไม่ได้ (${describeFetchError(e, url)})`), { status: 504 });
  }
  const body = await r.json().catch(() => null);
  if (!body) throw Object.assign(new Error(`${what}ตอบกลับมาไม่ใช่ JSON (HTTP ${r.status})`), { status: 502 });
  if (body.status !== 'success') {
    // 4xx จากชั้นล่าง (รหัสผิด / ข้อมูลไม่ครบ) ส่งต่อเป็น 4xx ให้หน้าเว็บโชว์ข้อความตามนั้น
    const status = r.status >= 400 && r.status < 500 ? r.status : 502;
    throw Object.assign(new Error(body.message || `${what}ตอบ HTTP ${r.status}`), { status, body });
  }
  return body;
}

/** เรียก action ของ office-server — คืน data */
export async function office(action, payload = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.USAGE_API_TOKEN) headers['x-api-token'] = process.env.USAGE_API_TOKEN;
  const body = await fetchJson(`${OFFICE_BASE()}/schedule`, {
    method: 'POST',
    headers,
    // _user เป็นตัวแทนของแอปนี้เอง — สิทธิ์จริงของร้านตรวจจาก token ที่ api/* ก่อนเรียกมาถึงที่นี่แล้ว
    body: JSON.stringify({ action, ...payload, _user: { username: 'ordernaraipizzeria', branch: 'all' } }),
  }, 20000, 'เซิร์ฟเวอร์ที่ออฟฟิศ');
  return body.data;
}

/** GET endpoint ของ narai-branch — คืน body ทั้งก้อน */
export async function branchGet(path, params) {
  const qs = new URLSearchParams(params).toString();
  return fetchJson(`${BRANCH_BASE()}${path}?${qs}`, {}, 30000, 'ระบบเบิกของ (narai-branch)');
}

/** POST endpoint ของ narai-branch — คืน body ทั้งก้อน */
export async function branchPost(path, payload) {
  return fetchJson(`${BRANCH_BASE()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, 45000, 'ระบบเบิกของ (narai-branch)');
}
