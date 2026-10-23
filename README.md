# ordernaraipizzeria — เว็บเบิกของของร้าน

ร้านล็อกอินด้วย **รหัสร้าน** (รหัสสาขาภาษาอังกฤษ 3 ตัว หรือรหัสตัวเลข) แล้วเบิกวัตถุดิบ/ของใช้จากคลังกลาง
ใบเบิกลงระบบ POS ทันทีแบบเดียวกับปุ่ม "สั่งของ" ในหน้านับสต๊อกของ narai-branch
ผู้ดูแลจัดการทะเบียนร้านได้: รหัสตัวเลข + รหัสสาขา 3 ตัว + ชื่ออธิบาย + รหัสผ่านร้าน + เปิด/ปิดใช้งาน

## ใช้ฐานข้อมูลและ API ชุดเดียวกับ narai-branch

แอปนี้ไม่มีฐานข้อมูลหรือเซิร์ฟเวอร์ของตัวเอง ทุกอย่างอยู่บนเครื่อง 203.154.185.48 ที่ใช้อยู่แล้ว

```
เบราว์เซอร์ร้าน
   │  Bearer token (เซ็นด้วย AUTH_SECRET — ร้านปลอมเป็นร้านอื่นไม่ได้)
   ▼
ordernaraipizzeria /api/* (Vercel)
   ├─► office-server POST /schedule ──► SQL Server · InventoryNarai
   │      orderShopLogin / orderShopList / orderShopSave     dbo.order_shop (ใหม่)
   │      orderShopItems                                      dbo.stock_item, stock_item_branch (เดิม)
   │      storefctLogin (ผู้ดูแล)                             dbo.storefct_user (เดิม)
   │
   └─► narai-branch /api/insert_order, /api/pending_orders ──► MySQL myfbdata (POS)
                                                               orderd / invoice (ตัวใบเบิกจริง)
```

- **ทะเบียนร้าน** เก็บที่ `InventoryNarai.dbo.order_shop` (ตารางใหม่ ดู `office-server/sql/ordershop-001-shops.sql` ใน narai-branch)
- **ทะเบียนสินค้า** อ่านจาก `dbo.stock_item` ตัวเดียวกับหน้านับสต๊อก ร้านที่ผูกสินค้าไว้ใน `stock_item_branch` เห็นเฉพาะของตัวเอง
- **ใบเบิก** ไม่ได้เก็บใน InventoryNarai แต่ลง `myfbdata.orderd` ของ POS ผ่าน `/api/insert_order` ตัวเดิม
  เลขที่ใบเดินจาก `Cfg_LstOrdID` ของสาขา โกดังจึงเห็นใบในระบบเดิมโดยไม่ต้องแก้อะไร
- หมวด `ผัก` / `ห้องผัก` แยกเป็นใบของตัวเองตามกติกาเดิม (`public/js/orderGroups.js`)
- **รหัสตัวเลขของร้าน = outlet ของ POS** (Ord_StrID) ร้านใหม่ต้องมีฐาน `myfbdata<รหัสสาขา>` ใน POS แล้ว
  ไม่งั้น insert_order จะตอบว่า "ไม่พบฐานข้อมูลของสาขา"

## หน้าเว็บ

| หน้า | ใครใช้ | ทำอะไร |
|---|---|---|
| เข้าสู่ระบบ | ร้าน / ผู้ดูแล | ร้าน: รหัสร้าน + รหัสผ่าน · ผู้ดูแล: บัญชีแอดมินของ storefct |
| `#order` เบิกของ | ร้าน | ค้นหา/กรองตามหมวด ใส่จำนวน (ปัดขึ้นตามหน่วยเบิก) เลือกวันรับ ตรวจทาน แล้วส่ง — ร่างเก็บในเครื่องไว้ |
| `#history` ใบเบิกของร้าน | ร้าน | ใบเบิก 60 วัน สถานะรอรับ/รับแล้วจาก POS กดดูรายการในใบ |
| `#shops` จัดการร้าน | ผู้ดูแล | เพิ่ม/แก้ร้าน ตั้งรหัสผ่านใหม่ เปิด/ปิดใช้งาน |

## ติดตั้ง

1. **office-server (narai-branch)** — อัปเดตโค้ดแล้วรัน `update-office-server.bat` ตามปกติ
   ตัวรัน migration จะสร้างตาราง `dbo.order_shop` ให้เอง แล้ว service จะมี action `orderShop*` (เช็คได้ที่ `/health`)
2. **Vercel** — import repo นี้ ไม่ต้องตั้ง build command แล้วใส่ env ตาม `.env.example`
3. ล็อกอินเป็นผู้ดูแล (บัญชีแอดมินของ storefct) → จัดการร้าน → เพิ่มร้านพร้อมตั้งรหัสผ่าน แล้วแจ้งรหัสให้ร้าน

## พัฒนา

ไม่มี dependency — ต้องการแค่ Node 20 ขึ้นไป

```bash
npm run demo   # http://localhost:3000 ข้อมูลตัวอย่างในเบราว์เซอร์ (ร้าน SUM / ผู้ดูแล admin · รหัส 123456)
npm run dev    # ต่อหลังบ้านจริง ต้องตั้ง env ตาม .env.example ก่อน
npm test       # ทดสอบ api/* ด้วย office-server/narai-branch จำลอง
```
