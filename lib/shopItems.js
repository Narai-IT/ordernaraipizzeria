// สินค้าที่ร้านเบิกได้ = สองแหล่งรวมกัน
//   1) ที่ผู้ดูแลเลือกให้ร้านนี้เอง          dbo.order_shop_item     (หน้า "สินค้าที่เบิกได้" ของเว็บนี้)
//   2) ที่ติ๊กสาขานี้ไว้ในหน้าวัตถุดิบของ office  dbo.stock_item_branch   (QC/RD → วัตถุดิบ → "สาขาที่ใช้ไอเทมนี้")
//
// ข้อ 2 ทำให้ติ๊กที่ office แล้วร้านเห็นในหน้าเบิกทันที ไม่ต้องมาเลือกซ้ำที่นี่
// ทั้งสองอย่างได้จาก action orderShopGetItems ตัวเดียว (selected / inBranch) — จับคู่สาขาด้วย branch_code
// ตัดของที่ปิดการใช้งานในทะเบียนให้อยู่แล้ว (ดู office-server/ordershop.js ใน narai-branch)
//
// ใช้ทั้งตอนแสดงหน้าเบิกและตอนตรวจใบเบิกก่อนส่ง — สองที่ต้องได้รายการชุดเดียวกันเสมอ
// ไม่งั้นร้านจะเห็นของที่ส่งไม่ได้ หรือส่งของที่ไม่ได้เห็น

import { office } from './office.js';

/** แยกออกมาให้ทดสอบได้ — แถวจาก orderShopGetItems -> รายการที่ร้านเบิกได้ */
export function pickAllowed(rows) {
  return (rows || [])
    .filter((it) => it.selected || it.inBranch)
    .map(({ selected, inBranch, ...it }) => ({ ...it, fromBranch: Boolean(inBranch && !selected) }));
}

/**
 * @returns {{ items: object[], configured: boolean }}
 * อ่านแบบรวมไม่ได้ (เช่น office-server ตอบช้า) ถอยไปใช้เฉพาะที่ผู้ดูแลเลือกไว้ (orderShopItems)
 * ร้านยังเบิกได้ แค่ไม่เห็นของที่มาจากการติ๊กที่ office ชั่วคราว
 */
export async function shopAllowedItems(shopNo) {
  try {
    const { items } = await office('orderShopGetItems', { shopNo });
    const allowed = pickAllowed(items);
    return { items: allowed, configured: allowed.length > 0 };
  } catch (e) {
    if (e.status && e.status < 500) throw e;   // ร้านไม่มีในทะเบียน ฯลฯ — ไม่ใช่เรื่องที่ถอยแล้วหาย
    console.error('[shopItems] orderShopGetItems ไม่ได้ ถอยไปใช้ orderShopItems:', e.message);
    const { items, configured } = await office('orderShopItems', { shopNo });
    return { items, configured };
  }
}
