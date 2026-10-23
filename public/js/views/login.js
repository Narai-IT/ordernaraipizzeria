// หน้าเข้าสู่ระบบ — แท็บ "ร้าน" (รหัสร้าน + รหัสผ่าน) กับ "ผู้ดูแล" (บัญชีแอดมินของ storefct)

import { h, store } from '../ui.js';
import { api, DEMO } from '../api.js';
import { logo } from '../app.js';

const LAST_SHOP = 'order_last_shop';

export function renderLogin(root, onLoggedIn) {
  let mode = 'shop';
  const err = h('p', { class: 'err', role: 'alert' });

  const shopInput = h('input', {
    id: 'login-shop', class: 'input code', autocomplete: 'username', placeholder: 'เช่น SUM หรือ 51',
    value: store.get(LAST_SHOP, ''), maxlength: '6', required: true,
  });
  const userInput = h('input', { id: 'login-user', class: 'input', autocomplete: 'username', placeholder: 'ชื่อผู้ใช้' });
  const passInput = h('input', { id: 'login-pass', class: 'input', type: 'password', autocomplete: 'current-password', placeholder: 'รหัสผ่าน', required: true });

  const shopField = h('label', { class: 'field' }, h('span', {}, 'รหัสร้าน'), shopInput,
    h('small', {}, 'ใส่รหัสสาขาภาษาอังกฤษ 3 ตัว หรือรหัสตัวเลขของร้านก็ได้'));
  const userField = h('label', { class: 'field', hidden: true }, h('span', {}, 'ชื่อผู้ใช้ผู้ดูแล'), userInput,
    h('small', {}, 'ใช้บัญชีแอดมินเดียวกับระบบสโตร์ (storefct)'));
  const submit = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'เข้าสู่ระบบ');

  const tabBtn = (key, label) => h('button', {
    type: 'button', role: 'tab', 'aria-selected': String(key === mode),
    onclick: () => {
      mode = key;
      tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b === tabsBtns[key])));
      shopField.hidden = key !== 'shop';
      userField.hidden = key !== 'admin';
      // ช่องที่ซ่อนอยู่ต้องไม่ required ไม่งั้นฟอร์มส่งไม่ได้
      shopInput.required = key === 'shop';
      userInput.required = key === 'admin';
      err.textContent = '';
      (key === 'shop' ? shopInput : userInput).focus();
    },
  }, label);
  const tabsBtns = { shop: tabBtn('shop', 'ร้านที่เบิกของ'), admin: tabBtn('admin', 'ผู้ดูแลระบบ') };
  const tabs = h('div', { class: 'tabs', role: 'tablist' }, tabsBtns.shop, tabsBtns.admin);

  const form = h('form', {
    class: 'login-form',
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      submit.disabled = true;
      submit.textContent = 'กำลังตรวจสอบ…';
      try {
        const payload = mode === 'shop'
          ? { mode, shop: shopInput.value.trim().toUpperCase(), password: passInput.value }
          : { mode, username: userInput.value.trim(), password: passInput.value };
        const session = await api.login(payload);
        if (mode === 'shop') store.set(LAST_SHOP, payload.shop);
        onLoggedIn(session);
      } catch (ex) {
        err.textContent = ex.message;
        passInput.select();
      } finally {
        submit.disabled = false;
        submit.textContent = 'เข้าสู่ระบบ';
      }
    },
  },
  h('div', {}, h('h2', {}, 'เข้าสู่ระบบ'), h('p', { class: 'muted' }, 'ร้านเห็นและเบิกของได้เฉพาะของร้านตัวเอง')),
  tabs, shopField, userField,
  h('label', { class: 'field' }, h('span', {}, 'รหัสผ่าน'), passInput),
  err, submit,
  DEMO ? h('p', { class: 'muted', style: 'font-size:.85rem' },
    'ทดลอง: ร้าน ', h('b', { class: 'mono' }, 'SUM'), ' หรือ ', h('b', { class: 'mono' }, '51'),
    ' · ผู้ดูแล ', h('b', { class: 'mono' }, 'admin'), ' · รหัสผ่าน ', h('b', { class: 'mono' }, '123456')) : null);

  root.replaceChildren(h('main', { class: 'login' },
    h('div', { class: 'login-card' },
      h('section', { class: 'login-brand' },
        h('div', { style: 'display:grid;gap:14px' }, logo(40), h('h1', {}, 'ระบบเบิกของสาขา'),
          h('p', {}, 'เบิกวัตถุดิบและของใช้จากคลังกลางเข้าร้าน ใบเบิกเข้าระบบ POS ทันทีที่กดส่ง')),
        h('div', { class: 'slip', 'aria-hidden': 'true' },
          h('div', {}, h('span', {}, 'ใบเบิกเลขที่'), h('span', {}, '3487')),
          h('div', {}, h('span', {}, 'ร้าน'), h('span', {}, '51 · SUM')),
          h('div', {}, h('span', {}, 'คลังที่จ่าย'), h('span', {}, '490')),
          h('div', {}, h('span', {}, 'ประเภท'), h('span', {}, 'TRF')))),
      form)));
  (shopInput.value ? passInput : shopInput).focus();
}
