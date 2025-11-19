# คู่มือการพัฒนาและติดตั้งโปรเจกต์ Ask The Manual

เอกสารนี้รวบรวมข้อมูลเกี่ยวกับโครงสร้างโค้ด การติดตั้ง และการใช้งานโปรเจกต์ **Ask The Manual** ซึ่งเป็น Fullstack Application ที่ช่วยให้ผู้ใช้สามารถอัปโหลดคู่มือการใช้งาน (Manuals) และสอบถามข้อมูลจากคู่มือนั้นได้โดยใช้ AI (Gemini)

---

## 🛠 เทคโนโลยีที่ใช้ (Tech Stack)

*   **Frontend:** React, Vite, TypeScript
*   **Backend:** Node.js, Express, TypeScript
*   **Database:** PostgreSQL
*   **ORM:** Prisma
*   **AI Service:** Google Gemini API (genai)
*   **Infrastructure:** Docker (สำหรับการรัน Database)

---

## 📂 โครงสร้างโปรเจกต์ (Project Structure)

ไฟล์และโฟลเดอร์สำคัญในโปรเจกต์:

*   `root/`
    *   `components/` - เก็บ React Components สำหรับหน้า UI (เช่น `ChatInterface.tsx`, `UploadModal.tsx`)
    *   `server/` - โค้ดส่วน Backend
        *   `index.ts` - จุดเริ่มต้นของ Server (Entry point)
        *   `*_routes.ts` - กำหนด API endpoints ต่างๆ
        *   `prisma.ts` - การตั้งค่าการเชื่อมต่อ Prisma Client
    *   `services/` - โค้ดสำหรับติดต่อกับบริการภายนอก
        *   `geminiService.ts` - จัดการการเชื่อมต่อกับ Google Gemini API (Upload, Search, Generate)
    *   `prisma/`
        *   `schema.prisma` - กำหนดโครงสร้าง Database (User, Manual, ChatSession)
    *   `docker-compose.yml` - ไฟล์ตั้งค่า Docker สำหรับรัน PostgreSQL Database
    *   `package.json` - จัดการ Dependencies และ Scripts ของทั้งโปรเจกต์

---

## 🐳 Docker และ Database

โปรเจกต์นี้ใช้ **Docker** ในการจำลอง Environment สำหรับ Database (PostgreSQL) เพื่อความสะดวกในการติดตั้งและจัดการข้อมูล

ในไฟล์ `docker-compose.yml`:
*   สร้าง Service ชื่อ `postgres`
*   ใช้ Image `postgres:16`
*   กำหนด Port `5432`
*   ตั้งค่า Environment Variables เริ่มต้นสำหรับ Database (User/Pass/DB Name)

---

## 🚀 ขั้นตอนการติดตั้งและเริ่มต้นใช้งาน (Installation & Setup)

### 1. เตรียม Environment Variables (.env) **[สำคัญมาก]**

คุณจำเป็นต้องสร้างไฟล์ `.env` (หรือ `.env.local`) ที่ root ของโปรเจกต์ เพื่อกำหนดค่า config ต่างๆ โดยเฉพาะ API Key

สร้างไฟล์ `.env` และใส่ค่าดังนี้:

```env
# การตั้งค่า Database (ต้องตรงกับ docker-compose.yml)
DATABASE_URL="postgresql://askmanual:askmanual@localhost:5432/askmanual?schema=public"

# พอร์ตของ Server (ถ้าต้องการเปลี่ยน)
PORT=4000

# Origin ที่อนุญาตให้เข้าถึง API (Frontend URL)
CORS_ORIGIN="http://localhost:5173"

# คีย์สำหรับ Gemini AI (จำเป็นต้องใส่เพื่อให้ฟีเจอร์ AI ทำงานได้)
# คุณสามารถรับ API Key ได้จาก Google AI Studio
GEMINI_API_KEY="ใส่_API_KEY_ของคุณที่นี่"
```

> **⚠️ ข้อควรระวัง:** ห้ามเปิดเผยไฟล์ `.env` ที่มี API Key ของคุณสู่สาธารณะ

### 2. ติดตั้ง Dependencies

รันคำสั่งใน Terminal เพื่อติดตั้ง Library ต่างๆ:

```bash
npm install
```

### 3. เริ่มต้น Database ด้วย Docker

รันคำสั่งเพื่อเปิดใช้งาน PostgreSQL Container:

```bash
# รันแบบ background
npm run db:up
# หรือ: docker compose up -d postgres
```

### 4. เตรียม Database Schema (Prisma)

เมื่อ Database ทำงานแล้ว ให้รันคำสั่งเพื่อสร้างตารางใน Database:

```bash
npm run prisma:migrate
```

### 5. รันโปรเจกต์ (Development Mode)

เปิด Terminal 2 แท็บ:

**แท็บที่ 1 (Backend):**
```bash
npm run server:dev
```
Server จะทำงานที่ `http://localhost:4000`

**แท็บที่ 2 (Frontend):**
```bash
npm run dev
```
เว็บจะทำงานที่ `http://localhost:5173`

---

## 📝 คำอธิบายโค้ดเบื้องต้น

### การทำงานของระบบ AI (`services/geminiService.ts`)
*   `initialize()`: เริ่มต้น instance ของ Gemini ด้วย API Key
*   `createRagStore()`: สร้างพื้นที่เก็บข้อมูล (RAG Store) บน Gemini
*   `uploadToRagStore()`: อัปโหลดไฟล์ PDF เข้าสู่ RAG Store
*   `fileSearch()`: ส่งคำถามของผู้ใช้ไปให้ AI ค้นหาคำตอบจากไฟล์ที่อัปโหลด

### ระบบฐานข้อมูล (`prisma/schema.prisma`)
*   **User:** เก็บข้อมูลผู้ใช้
*   **Manual:** เก็บข้อมูลคู่มือที่อัปโหลด (เชื่อมโยงกับ RAG Store ของ Gemini)
*   **ChatSession:** เก็บประวัติการสนทนา
*   **Message:** เก็บข้อความถาม-ตอบแต่ละข้อความ

### Backend API (`server/`)
*   ใช้ **Express** เป็น Framework
*   มี Middleware `cors`, `cookie-parser` จัดการ request
*   แบ่ง Route เป็น `auth`, `manuals`, `chats` เพื่อความเป็นระเบียบ

---

หากมีข้อสงสัยหรือต้องการแก้ไขส่วนใด สามารถดูได้ที่ไฟล์ต้นฉบับในโฟลเดอร์ที่ระบุไว้ข้างต้น

