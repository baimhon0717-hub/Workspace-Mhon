# Routine Plan69 Tracker

เว็บติดตามงานภายในทีมจากไฟล์ `Routine Plan69 (1).xlsx`

## ใช้งานหลัก

- นำเข้าไฟล์ Excel เดิมและแปลงเป็นงาน เจ้าของงาน หมวดงาน รอบงาน และสถานะ
- Dashboard สรุปงานในเดือนที่เลือก งานเสร็จ งานเกินกำหนด และงานติดปัญหา
- Board แยกตาม 4 สถานะ: ยังไม่เริ่ม, กำลังทำ, เสร็จ, ติดปัญหา
- Calendar แสดงงานตามวันที่ และแยกงานรอบเวลาที่ไม่มีวันแน่นอน
- ส่งออกรายงานสถานะเป็นไฟล์ `.xls` ที่ Excel เปิดได้

## Deploy บน Vercel

โปรเจกต์นี้ตั้งค่าเริ่มต้นให้ Vercel ใช้ Next.js build แล้ว

```bash
npm install
npm run build
npm run start
```

ไฟล์ `vercel.json` กำหนดให้ใช้ `npm run build` และ output เป็น `.next`
จึงไม่ควรเจอ error ว่า `.next` หายหลัง build อีก

หมายเหตุ: โหมด Vercel ตอนนี้ใช้ server memory สำหรับข้อมูลที่ import ระหว่าง runtime
ถ้าต้องการฐานข้อมูลถาวรจริงบน Vercel ควรเพิ่ม Vercel Postgres หรือ storage อื่น

## Deploy ผ่าน Sites

ไฟล์ D1 และ migration ยังอยู่ใน repo สำหรับทาง Sites/Cloudflare

```bash
npm run dev:sites
npm run build:sites
npm run start:sites
```

หากใช้ Sites ให้ผูก D1 binding ชื่อ `DB` ตาม `.openai/hosting.json`
