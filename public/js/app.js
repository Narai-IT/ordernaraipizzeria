// โครงแอป — ตรวจเซสชัน, แถบบน, เปลี่ยนหน้าตาม #hash (order / history / shops)

import { h, toast, shopCode } from './ui.js';
import { api, DEMO, getToken } from './api.js';

let session = null;
const root = document.getElementById('app');

const ROUTES = {
  shop: [
    { key: 'order', label: 'เบิกของ', load: () => import('./views/order.js').then((m) => m.renderOrder) },
    { key: 'history', label: 'ใบเบิกของร้าน', load: () => import('./views/history.js').then((m) => m.renderHistory) },
  ],
  admin: [
    { key: 'shops', label: 'จัดการร้าน', load: () => import('./views/shops.js').then((m) => m.renderShops) },
  ],
};

/** โลโก้: ใบพิซซ่าแบ่งชิ้น ใช้สีตาม token */
export function logo(size = 26) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="2.5"/>'
    + '<path d="M16 16 L16 2 M16 16 L28.1 23 M16 16 L3.9 23" stroke="currentColor" stroke-width="2"/>'
    + '<circle cx="11" cy="10" r="2" fill="currentColor"/><circle cx="21.5" cy="12" r="2" fill="currentColor"/>'
    + '<circle cx="16" cy="24" r="2" fill="currentColor"/>';
  return svg;
}

export function navigate(key) {
  if (location.hash.slice(1) === key) route();
  else location.hash = key;
}

function logout() {
  api.logout();
  session = null;
  history.replaceState(null, '', location.pathname + location.search);
  route();
}

function shell(routes, active) {
  const who = session.role === 'shop'
    ? h('div', { class: 'who' }, shopCode(session.shopNo, session.code), h('span', { class: 'name' }, session.name))
    : h('div', { class: 'who' }, h('span', { class: 'label' }, 'ผู้ดูแล'), h('span', { class: 'name' }, session.name));
  const main = h('main', { id: 'view' });
  root.replaceChildren(
    DEMO ? demoBar() : '',
    h('header', { class: 'topbar' }, h('div', { class: 'topbar-in' },
      h('div', { class: 'brand' }, logo(), 'นาราย เบิกของ'),
      who,
      h('nav', { class: 'nav', 'aria-label': 'เมนู' },
        routes.map((r) => h('a', { href: `#${r.key}`, 'aria-current': r.key === active ? 'page' : false }, r.label)),
        h('a', { href: '#', onclick: (e) => { e.preventDefault(); logout(); } }, 'ออกจากระบบ')))),
    main);
  return main;
}

function demoBar() {
  return h('div', { class: 'demo-bar' },
    h('span', {}, 'โหมดตัวอย่าง: ข้อมูลทั้งหมดเป็นข้อมูลสมมติ ยังไม่ได้ต่อฐานข้อมูล InventoryNarai'),
    h('span', {}, 'ร้าน ', h('b', {}, 'SUM'), ' / ผู้ดูแล ', h('b', {}, 'admin'), ' · รหัสผ่าน ', h('b', {}, '123456')));
}

async function route() {
  // หน้าต่างที่ค้างจากหน้าก่อน (เช่น ผลการส่งใบเบิก) ไม่ควรตามไปหน้าใหม่
  document.querySelectorAll('.overlay').forEach((o) => o.remove());
  if (!session) {
    const { renderLogin } = await import('./views/login.js');
    const box = h('div');
    root.replaceChildren(DEMO ? demoBar() : '', box);
    renderLogin(box, (s) => {
      session = s;
      location.hash = ROUTES[s.role][0].key;
      route();
    });
    return;
  }
  const routes = ROUTES[session.role];
  const want = location.hash.slice(1);
  const r = routes.find((x) => x.key === want) || routes[0];
  const main = shell(routes, r.key);
  try {
    const render = await r.load();
    await render(main, session);
  } catch (e) {
    if (e?.status === 401) { toast(e.message, { bad: true }); logout(); return; }
    toast(e.message || 'เปิดหน้านี้ไม่สำเร็จ', { bad: true });
  }
}

window.addEventListener('hashchange', route);
window.addEventListener('unhandledrejection', (e) => {
  const err = e.reason;
  if (err?.status === 401) { toast(err.message, { bad: true }); logout(); }
  else if (err?.message) toast(err.message, { bad: true });
});

(async function start() {
  if (getToken()) {
    try {
      session = await api.me();
    } catch {
      api.logout();
    }
  }
  route();
})();
