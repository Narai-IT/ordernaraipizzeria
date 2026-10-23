// จัดการร้าน (ผู้ดูแล) — รหัสตัวเลข (outlet ของ POS) + รหัสสาขาภาษาอังกฤษ 3 ตัว + ชื่ออธิบาย + รหัสผ่านร้าน

import { h, modal, toast, busy, pill, shopCode } from '../ui.js';
import { api } from '../api.js';
import { openShopItems } from './shopItems.js';

const CODE_RE = /^[A-Z][A-Z0-9]{2}$/;

export async function renderShops(root) {
  const page = h('div', { class: 'page' }, h('div', { class: 'empty' }, 'กำลังโหลดรายชื่อร้าน…'));
  root.replaceChildren(page);

  let shops;
  try {
    ({ shops } = await api.shops());
  } catch (e) {
    page.replaceChildren(h('div', { class: 'empty' }, e.message));
    return;
  }

  let term = '';
  const tbody = h('tbody');
  const draw = () => {
    const t = term.trim().toLowerCase();
    const list = shops
      .filter((s) => !t || String(s.shopNo).includes(t) || s.code.toLowerCase().includes(t) || s.name.toLowerCase().includes(t))
      .sort((a, b) => a.code.localeCompare(b.code));
    tbody.replaceChildren(...(list.length ? list.map((s) => h('tr', {},
      h('td', { class: 'mono r' }, s.shopNo),
      h('td', { class: 'mono' }, h('b', {}, s.code)),
      h('td', { class: 'wrap' }, s.name),
      h('td', {}, s.isActive ? pill('ok', 'ใช้งาน') : pill('off', 'ปิดใช้งาน')),
      h('td', { class: 'r' }, h('button', {
        class: 'btn btn-sm', title: 'ตั้งรายการสินค้าที่ร้านนี้เบิกได้',
        onclick: () => openShopItems(s, (count) => { s.itemCount = count; draw(); }),
      }, s.itemCount ? h('span', { class: 'mono' }, `${s.itemCount} รายการ`) : h('span', { class: 'err' }, 'ยังไม่ได้ตั้ง'))),
      h('td', { class: 'muted' }, s.lastLoginAt ? s.lastLoginAt.slice(0, 16) : 'ยังไม่เคยเข้า'),
      h('td', { class: 'r' }, h('button', { class: 'btn btn-sm', onclick: () => edit(s) }, 'แก้ไข'))))
      : [h('tr', {}, h('td', { colspan: '7', class: 'empty' }, 'ไม่พบร้านที่ค้นหา'))]));
    count.textContent = `${shops.filter((s) => s.isActive).length} ร้านที่ใช้งาน · ทั้งหมด ${shops.length}`;
  };

  function edit(shop) {
    const isNew = !shop;
    const err = h('p', { class: 'err', role: 'alert' });
    const no = h('input', { id: 'shop-no', class: 'input mono', inputmode: 'numeric', value: shop?.shopNo ?? '', placeholder: 'เช่น 51' });
    const code = h('input', { id: 'shop-code', class: 'input code', maxlength: '3', value: shop?.code ?? '', placeholder: 'SUM' });
    const name = h('input', { id: 'shop-name', class: 'input', value: shop?.name ?? '', placeholder: 'ชื่อร้าน / สาขา ที่แสดงต่อท้ายรหัส', maxlength: '150' });
    const active = h('input', { id: 'shop-active', type: 'checkbox', checked: shop ? shop.isActive : true });
    const pass = h('input', {
      id: 'shop-pass', class: 'input', type: 'password', autocomplete: 'new-password',
      placeholder: isNew ? 'อย่างน้อย 6 ตัว' : 'เว้นว่าง = ใช้รหัสเดิม',
    });
    const preview = h('div', { class: 'preview-code' });
    const drawPreview = () => {
      code.value = code.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      no.value = no.value.replace(/\D/g, '');
      preview.replaceChildren(
        shopCode(no.value || '—', code.value || '———'),
        h('span', {}, name.value || h('span', { class: 'muted' }, 'ชื่ออธิบาย')));
    };
    [no, code, name].forEach((el) => el.addEventListener('input', drawPreview));
    drawPreview();

    modal(isNew ? 'เพิ่มร้าน' : `แก้ไขร้าน ${shop.code}`, (close) => {
      const save = h('button', { class: 'btn btn-primary', onclick: () => busy(save, async () => {
        err.textContent = '';
        if (!/^\d+$/.test(no.value) || Number(no.value) <= 0) { err.textContent = 'รหัสตัวเลขต้องเป็นตัวเลขจำนวนเต็ม'; return; }
        if (!CODE_RE.test(code.value)) { err.textContent = 'รหัสสาขาต้องเป็นภาษาอังกฤษ 3 ตัว ตัวแรกเป็นตัวอักษร (เช่น SUM, P90)'; return; }
        if (!name.value.trim()) { err.textContent = 'กรุณาใส่ชื่ออธิบายร้าน'; return; }
        if (isNew && pass.value.length < 6) { err.textContent = 'ร้านใหม่ต้องตั้งรหัสผ่านอย่างน้อย 6 ตัว'; return; }
        try {
          const { shop: saved } = await api.saveShop({
            isNew, originalShopNo: shop?.shopNo, shopNo: Number(no.value), code: code.value,
            name: name.value.trim(), isActive: active.checked, password: pass.value || undefined,
          });
          shops = shops.filter((s) => s.shopNo !== (shop?.shopNo ?? saved.shopNo));
          shops.push({ ...saved, itemCount: shop?.itemCount || 0 });
          draw();
          close();
          toast(`บันทึกร้าน ${saved.code} แล้ว`);
        } catch (e) {
          err.textContent = e.message;
        }
      }) }, 'บันทึก');
      return [[
        preview,
        h('div', { class: 'grid2' },
          h('label', { class: 'field' }, h('span', {}, 'รหัสตัวเลข'), no,
            h('small', {}, 'เลข outlet ของร้านในระบบ POS ใบเบิกจะลงในนามเลขนี้')),
          h('label', { class: 'field' }, h('span', {}, 'รหัสสาขา (อังกฤษ 3 ตัว)'), code,
            h('small', {}, 'ร้านใช้รหัสนี้ล็อกอิน'))),
        h('label', { class: 'field' }, h('span', {}, 'ชื่ออธิบาย'), name),
        h('label', { class: 'field' }, h('span', {}, isNew ? 'รหัสผ่านของร้าน' : 'ตั้งรหัสผ่านใหม่'), pass),
        h('label', { class: 'switch' }, active, h('span', {}, 'เปิดใช้งาน (ปิดแล้วร้านล็อกอินไม่ได้)')),
        err,
      ], [h('button', { class: 'btn', onclick: close }, 'ยกเลิก'), save]];
    });
  }

  const count = h('p');
  const search = h('input', {
    id: 'shop-search', class: 'input', type: 'search', placeholder: 'ค้นหารหัสหรือชื่อร้าน', style: 'max-width:320px',
    oninput: () => { term = search.value; draw(); },
  });

  page.replaceChildren(
    h('div', { class: 'page-head' },
      h('div', {}, h('h1', {}, 'จัดการร้านที่เบิกของ'), count),
      h('button', { class: 'btn btn-primary', onclick: () => edit(null) }, '+ เพิ่มร้าน')),
    h('div', { class: 'toolbar' }, search),
    h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {},
        h('th', { class: 'r' }, 'รหัสตัวเลข'), h('th', {}, 'รหัสสาขา'), h('th', {}, 'ชื่ออธิบาย'),
        h('th', {}, 'สถานะ'), h('th', { class: 'r' }, 'สินค้าที่เบิกได้'), h('th', {}, 'เข้าใช้ล่าสุด'), h('th', {}))),
      tbody)));
  draw();
}
