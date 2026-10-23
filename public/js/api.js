// เรียก /api/* ของแอปนี้ — โหมดเดโม (meta app-mode = demo) ใช้ข้อมูลตัวอย่างใน demo.js แทน

import { store } from './ui.js';

export const DEMO = document.querySelector('meta[name="app-mode"]')?.content === 'demo';

const TOKEN_KEY = 'order_token';
export const getToken = () => store.get(TOKEN_KEY, '');
export const setToken = (t) => (t ? store.set(TOKEN_KEY, t) : store.del(TOKEN_KEY));

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function call(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let r;
  try {
    r = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError('ต่ออินเทอร์เน็ตไม่ได้ ตรวจสอบสัญญาณแล้วลองใหม่', 0);
  }
  const data = await r.json().catch(() => null);
  if (!data) throw new ApiError(`เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ (HTTP ${r.status})`, r.status);
  // ส่งใบเบิกได้บางใบ (partial) ไม่ใช่ error — หน้าเว็บต้องเห็นผลรายใบ
  if (data.status === 'error') throw new ApiError(data.message || 'เกิดข้อผิดพลาด', r.status, data);
  return data;
}

let demo;
const backend = async () => (DEMO ? (demo ||= await import('./demo.js')) : null);

export const api = {
  async login(payload) {
    const d = await backend();
    const res = d ? await d.login(payload) : await call('/api/auth', { method: 'POST', body: payload });
    setToken(res.token);
    return res.session;
  },
  async me() {
    const d = await backend();
    const res = d ? await d.me(getToken()) : await call('/api/auth');
    if (res.token) setToken(res.token);
    return res.session;
  },
  logout() { setToken(''); },
  async items() { const d = await backend(); return d ? d.items(getToken()) : call('/api/items'); },
  async orders() { const d = await backend(); return d ? d.orders(getToken()) : call('/api/orders'); },
  async order(no) {
    const d = await backend();
    return d ? d.order(getToken(), no) : call(`/api/orders?no=${encodeURIComponent(no)}`);
  },
  async submit(payload) {
    const d = await backend();
    return d ? d.submit(getToken(), payload) : call('/api/orders', { method: 'POST', body: payload });
  },
  async shops() { const d = await backend(); return d ? d.shops(getToken()) : call('/api/shops'); },
  async shopItems(shopNo) {
    const d = await backend();
    return d ? d.shopItems(getToken(), shopNo) : call(`/api/shops?items=${encodeURIComponent(shopNo)}`);
  },
  async setShopItems(shopNo, codes) {
    const d = await backend();
    return d ? d.setShopItems(getToken(), shopNo, codes)
      : call('/api/shops', { method: 'POST', body: { op: 'setItems', shopNo, codes } });
  },
  async saveShop(payload) {
    const d = await backend();
    return d ? d.saveShop(getToken(), payload) : call('/api/shops', { method: 'POST', body: payload });
  },
};
