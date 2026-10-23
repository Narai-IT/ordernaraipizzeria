// แบ่งรายการเบิกเป็นใบ — กติกาเดียวกับปุ่ม "สั่งของ" ของ narai-branch (src/pages/StockList.jsx)
// หมวดใน SPLIT_ORDER_CATEGORIES แยกเป็นใบเบิกของตัวเอง ที่เหลือรวมเป็น "ใบเบิกทั่วไป" 1 ใบ
// โกดังจัดของห้องผักแยกจากของแห้ง ถ้ารวมใบเดียวกันจะจัดของช้าทั้งใบ
//
// ใช้ไฟล์เดียวทั้งสองฝั่ง: หน้าเว็บแสดงตัวอย่างใบก่อนกดส่ง ส่วน api/orders.js แบ่งใบจริงตอนส่ง
// (อยู่ใน public/ เพราะเบราว์เซอร์ต้องโหลดได้ ฝั่ง api import ข้ามโฟลเดอร์มาเอง)

export const SPLIT_ORDER_CATEGORIES = ['ผัก', 'ห้องผัก'];

const catOf = (it) => String(it.storeCat || '').trim();

/** เรียงตามหมวดสโตร์ (ไม่มีหมวดไว้ท้าย) ลำดับนี้กลายเป็น Ord_Seq ในใบเบิก */
export function byStoreCat(a, b) {
  const ca = catOf(a);
  const cb = catOf(b);
  if (!ca !== !cb) return ca ? -1 : 1;
  return ca.localeCompare(cb, 'th') || String(a.code).localeCompare(String(b.code));
}

export function partitionOrderGroups(items) {
  const sorted = [...items].sort(byStoreCat);
  const main = [];
  const special = {};
  for (const it of sorted) {
    const cat = catOf(it);
    if (SPLIT_ORDER_CATEGORIES.includes(cat)) (special[cat] = special[cat] || []).push(it);
    else main.push(it);
  }
  const groups = [];
  if (main.length) groups.push({ label: 'ใบเบิกทั่วไป', cat: null, items: main });
  for (const cat of SPLIT_ORDER_CATEGORIES) {
    if (special[cat]?.length) groups.push({ label: `ใบเบิก ${cat}`, cat, items: special[cat] });
  }
  return groups;
}
