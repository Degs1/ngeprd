# 1. Pahami

** ngePRD ** adalah aplikasi web interaktif yang membantu solo developer dan vibe coder mengubah ide mentah menjadi rencana arsitektur dan dokumen `prd.md` siap eksekusi. Aplikasi ini menggabungkan **Infinite Canvas**, **Node-Based Graph**, dan **Interactive Card Editor**, di mana AI memandu proses perencanaan melalui pertanyaan pilihan ganda terstruktur (bukan text chat biasa) yang dapat diedit secara visual sebelum diekspor menjadi PRD lengkap.

---

# 2. Rencana Pengerjaan (Plan)

- **Tujuan Akhir**: Aplikasi web kanvas visual yang dapat menerima input ide, memvisualisasikan alur pematangan ide dalam bentuk node kartu beropsi ganda, dan mengekspor dokumen `prd.md` beserta daftar task terstruktur.
- **Strategi Scope Realistis (Alokasi 2-5 jam/minggu)**:
  - **Fase MVP**: Berfokus 100% pada *Core Experience* (Kanvas + AI Questionnaire + Node Editing + Export `prd.md` + Local Storage).
  - **Fase Nanti**: Fitur User Auth (Clerk/NextAuth), Cloud Database (MongoDB Atlas), Kuota 3 PRD, dan Payment Gateway (Midtrans Top-up Token) ditunda ke Fase 2 agar MVP dapat selesai dalam 2-3 minggu tanpa terhambat integrasi payment.
- **Tech Stack Terpilih**:
  - **Framework**: Next.js 14/15 (App Router, TypeScript)
  - **Styling & UI**: Tailwind CSS, Lucide React, Radix UI / Shadcn UI
  - **Canvas & Node Engine**: `@xyflow/react` (React Flow)
  - **Graph Auto-Layout**: `dagre`
  - **State Management**: Zustand
  - **AI Integration**: Vercel AI SDK (`ai` + `@ai-sdk/google` / `@ai-sdk/openai`) dengan Structured Output (`generateObject` + Zod)
  - **Penyimpanan MVP**: LocalStorage / IndexedDB (Zero Cloud Database Cost di awal)
  - **Deployment**: Vercel Free Tier

---

# 3. Product Requirement Document (PRD)

## 1. Ringkasan
Visual PRD Planner adalah tool visual berbasis web untuk merancang spesifikasi produk digital dari ide mentah menjadi dokumen `prd.md` yang siap pakai untuk *vibe coding*. Menggabungkan infinite canvas, node graph, dan kartu interaktif dengan opsi pilihan ganda, aplikasi ini mengeliminasi *blank page syndrome* bagi solo creator saat merencanakan aplikasi.

## 2. Masalah & Tujuan
- **Masalah**: Solo developer sering kali bingung menentukan batasan scope, arsitektur, dan rincian fitur saat memulai ide baru; chatbot teks konvensional menghasilkan jawaban panjang yang sulit diedit strukturnya secara visual.
- **Tujuan**: Menyediakan alur perencanaan visual terarah yang menghasilkan dokumen PRD spesifik dengan kriteria selesai yang teruji.
- **Definisi Berhasil**: Pengguna dapat memasukkan 1 ide mentah, menjawab 3-5 node pertanyaan pilihan ganda di kanvas, mengedit alur jika perlu, dan mengunduh file `prd.md` yang valid dalam waktu kurang dari 5 menit.

## 3. Di Luar Scope (Out of Scope untuk MVP)
- Sistem autentikasi pengguna (login / sign up).
- Cloud Database (MongoDB Atlas) dan sinkronisasi multi-device.
- Sistem kuota token berbayar (top-up Rp 15.000/token) dan integrasi Payment Gateway (Midtrans/Xendit).
- Kolaborasi real-time (multiplayer canvas).
- Eksekusi kode langsung dari kanvas (agent code runner).

## 4. Pengguna & Skenario Penggunaan
- **Target Pengguna**: Solo developer, vibe coder, atau indie hacker yang ingin menyusun rencana teknis sebelum melakukan coding dengan bantuan AI.
- **Alur Utama (Happy Path)**:
  1. Pengguna membuka aplikasi dan mengetikkan ide singkat di input bar (contoh: *"Web marketplace jasa cuci sepatu"*).
  2. Kanvas memunculkan **Node Awal (Ide)** yang terhubung secara otomatis ke 2-3 **Node Pertanyaan AI** berbentuk kartu interaktif.
  3. Setiap kartu menampilkan pertanyaan spesifik (Tech stack, target platform, scope MVP) beserta 2-4 tombol opsi siap-klik.
  4. Pengguna mengklik opsi yang diinginkan (atau mengetik kustomisasi), lalu status node berubah menjadi *Selesai*.
  5. Pengguna dapat menambah, menggeser, atau menghapus node secara visual di kanvas.
  6. Setelah semua cabang pertanyaan terjawab, pengguna menekan tombol **"Generate PRD"**.
  7. Panel drawer samping menampilkan preview `prd.md` lengkap dengan breakdown task, dilengkapi tombol **"Copy Markdown"** dan **"Download .md"**.

## 5. Daftar Fitur

| ID | Fitur | Prioritas | Kriteria Selesai |
| :--- | :--- | :--- | :--- |
| **FEAT-01** | Infinite Canvas Viewport | **MVP** | Kanvas dapat di-pan (drag) dan di-zoom (scroll), memiliki grid background titik-titik, dan kontrol minimap. |
| **FEAT-02** | Custom Card Node Component | **MVP** | Node berbentuk kartu dengan header tipe, teks pertanyaan/keputusan, badge status (*Pending / Answered*), dan tombol opsi interaktif. |
| **FEAT-03** | AI Structured Questioning | **MVP** | Endpoint API menerima ide/konteks dan mengembalikan array JSON pertanyaan + opsi valid menggunakan Zod schema. |
| **FEAT-04** | Node & Edge State Management | **MVP** | Memilih opsi pada kartu langsung memperbarui state Zustand, mengubah warna status node, dan memicu kalkulasi alur berikutnya. |
| **FEAT-05** | Auto-Layouting Graph (Dagre) | **MVP** | Node baru yang dihasilkan AI terposisikan secara otomatis dari kiri ke kanan (atau atas ke bawah) tanpa bertumpuk (*no overlapping*). |
| **FEAT-06** | Manual Canvas Editing | **MVP** | Pengguna dapat menarik garis koneksi (*edge*) baru, memindahkan posisi kartu secara bebas, atau menghapus node yang tidak relevan. |
| **FEAT-07** | PRD & Task Generator Engine | **MVP** | Mengompilasi seluruh node keputusan yang terjawab menjadi satu dokumen Markdown terstruktur dengan format PRD + Daftar Task (T1, T2..). |
| **FEAT-08** | Export & Copy Drawer | **MVP** | Drawer/modal menampilkan pratinjau Markdown ter-render, tombol *Copy to Clipboard* (dengan toast feedback), dan tombol *Download prd.md*. |
| **FEAT-09** | Local Storage Persistence | **MVP** | Seluruh data kanvas (node, edge, riwayat jawaban) otomatis tersimpan ke `localStorage` browser dan dapat di-load ulang saat halaman di-refresh. |
| **FEAT-10** | User Auth & Cloud Sync (MongoDB) | Nanti | Pengguna dapat login dan menyimpan project ke cloud database MongoDB. |
| **FEAT-11** | Token Quota & Payment Gateway | Nanti | Batas gratis 3 PRD per akun; sistem pembelian token Rp 15.000 / PRD via Midtrans/Xendit. |

## 6. Alur & Kasus Khusus
- **Koneksi AI Terputus / Rate Limit**: Jika API AI error saat generate pertanyaan, tampilkan kartu peringatan merah pada node dengan tombol *"Coba Lagi"* tanpa merusak node yang sudah ada.
- **Kondisi Kanvas Kosong (Empty State)**: Saat pertama kali dibuka, tampilkan prompt input dialog di tengah kanvas: *"Apa ide project yang ingin kamu rancang hari ini?"*
- **Jawaban Kustom**: Setiap kartu pertanyaan menyediakan opsi input teks bebas jika pilihan yang disediakan AI belum mencukupi.

## 7. Kebutuhan Teknis
- **Platform**: Web Modern (Responsif Desktop/Tablet, diutamakan pointer mouse).
- **Frontend Stack**: Next.js 14/15, React 18/19, TypeScript, Tailwind CSS, `@xyflow/react`, `dagre`, `zustand`, `lucide-react`.
- **Backend / AI Stack**: Next.js Route Handlers, Vercel AI SDK (`generateObject` dengan Zod schema). Model default: `gemini-1.5-flash` atau `gpt-4o-mini` (efisien dan berbiaya sangat rendah).
- **Penyimpanan Data MVP**: Browser `localStorage` (Key: `vibeplan_canvas_state`).
- **Batasan Biaya**: $0 (Free-tier Vercel + Free-tier API quota).

## 8. Tahapan Pengerjaan (Milestones)
- **Milestone 1**: Setup project, konfigurasi Tailwind, Shadcn UI, dan inisialisasi React Flow canvas (Estimasi: 3-4 jam).
- **Milestone 2**: Pembuatan Custom Card Node dan State Store Zustand (Estimasi: 3-4 jam).
- **Milestone 3**: Integrasi AI API Route dengan Structured JSON Output (Estimasi: 3-5 jam).
- **Milestone 4**: Auto-layout dengan Dagre dan interaktivitas klik opsi (Estimasi: 4-5 jam).
- **Milestone 5**: PRD Compiler, Preview Drawer, dan Export Markdown (Estimasi: 3-4 jam).
- **Milestone 6**: Local persistence, polishing UI, dan deployment Vercel (Estimasi: 2-3 jam).

## 9. Asumsi & Pertanyaan Terbuka
- `[ASUMSI]` Model AI yang digunakan untuk backend API adalah Google Gemini 1.5 Flash atau OpenAI GPT-4o-mini karena latensinya rendah dan murah.
- `[ASUMSI]` User menggunakan laptop/desktop saat merancang di canvas untuk kenyamanan interaksi drag & drop.
- `[PERTANYAAN TERBUKA]` Apakah kunci API AI (API Key) akan di-hardcode di environment server `.env.local` milik pembuat aplikasi, atau menyediakan form BYOK (Bring Your Own Key) untuk user lain di MVP? *(Rekomendasi MVP: Gunakan API Key di server `.env.local` untuk personal use, dengan fallback input BYOK di settings)*.

---

# 4. Daftar Task untuk Agent Coding

Pekerjaan dipecah menjadi task-task kecil berurutan yang masing-masing dapat langsung dijalankan dan diuji:

### **T1: Project Initialization & Canvas Hello World**
- **Tujuan**: Menyiapkan kerangka kerja Next.js dengan TypeScript, Tailwind CSS, dan menampilkan halaman kanvas React Flow dasar yang dapat di-pan dan di-zoom.
- **File Terlibat**:
  - `package.json`
  - `src/app/page.tsx`
  - `src/app/globals.css`
  - `src/components/canvas/FlowCanvas.tsx`
- **Kriteria Selesai**:
  - Jalankan `npm run dev`. Buka `http://localhost:3000`.
  - Halaman menampilkan viewport kanvas berlatar belakang dot-grid, berisi minimal 1 node statis bertuliskan *"Start Planning"*, dan dapat di-drag serta di-zoom dengan mouse.

### **T2: Zustand Store & Custom Question Card Node**
- **Tujuan**: Membuat komponen custom node React Flow berbentuk kartu interaktif yang memiliki title, pertanyaan, daftar button pilihan opsi, dan status.
- **File Terlibat**:
  - `src/types/canvas.ts`
  - `src/store/useCanvasStore.ts`
  - `src/components/canvas/QuestionCardNode.tsx`
- **Kriteria Selesai**:
  - Node di kanvas menampilkan style Card modern (Tailwind).
  - Terdapat tombol-tombol opsi di dalam kartu. Mengklik salah satu opsi memicu state update (opsi yang dipilih memiliki highlight warna aktif dan status berubah menjadi `answered`).

### **T3: AI Question Generation Route (Structured Output)**
- **Tujuan**: Membangun endpoint Next.js Route Handler yang menerima ide awal dan mengembalikan daftar pertanyaan terstruktur dalam format JSON menggunakan Vercel AI SDK dan Zod.
- **File Terlibat**:
  - `.env.local`
  - `src/app/api/plan/questions/route.ts`
  - `src/lib/ai/prompts.ts`
- **Kriteria Selesai**:
  - Jalankan `curl -X POST http://localhost:3000/api/plan/questions -H "Content-Type: application/json" -d '{"idea":"Website portofolio fotografer"}'`.
  - Endpoint mengembalikan status `200 OK` dengan body JSON berisi minimal 3 objek pertanyaan yang memiliki `id`, `question`, dan `suggestions` (array string).

### **T4: Graph Integration & Auto-Layout (Dagre)**
- **Tujuan**: Menghubungkan input ide dari UI ke endpoint AI, lalu secara otomatis menambahkan node-node pertanyaan ke kanvas dan menata posisinya dengan algoritma Dagre agar rapi.
- **File Terlibat**:
  - `src/lib/layout/dagre.ts`
  - `src/components/canvas/FlowCanvas.tsx`
  - `src/components/canvas/IdeaInputModal.tsx`
- **Kriteria Selesai**:
  - Pengguna memasukkan ide di modal input -> menekan "Generate Plan".
  - Loading spinner muncul, kemudian kanvas terisi node ide awal yang terhubung dengan garis (*edges*) ke node-node pertanyaan AI tanpa ada node yang bertumpuk.

### **T5: Interactive Option Selection & Progressive Branching**
- **Tujuan**: Menjadikan kanvas responsif terhadap jawaban user; ketika opsi pada suatu kartu dipilih, simpan jawaban ke context store dan memungkinkan pembuatan node lanjutan jika diperlukan.
- **File Terlibat**:
  - `src/store/useCanvasStore.ts`
  - `src/components/canvas/QuestionCardNode.tsx`
- **Kriteria Selesai**:
  - Setiap kartu yang sudah dipilih opsinya menampilkan tanda centang hijau.
  - Ringkasan jawaban tersimpan di Zustand state `answersMap`.

### **T6: PRD & Task Generation API**
- **Tujuan**: Membuat endpoint API untuk mengompilasi seluruh jawaban dari node yang aktif menjadi dokumen Markdown lengkap (`prd.md`) beserta daftar task berurutan (T1, T2, dst.).
- **File Terlibat**:
  - `src/app/api/plan/synthesize/route.ts`
  - `src/lib/ai/prdPrompt.ts`
- **Kriteria Selesai**:
  - Mengirim payload kumpulan jawaban pertanyaan ke endpoint menghasilkan response text markdown yang valid dan mengikuti template PRD standar.

### **T7: PRD Preview Drawer & Export Features**
- **Tujuan**: Menambahkan panel slide-over (drawer) untuk membaca pratinjau Markdown ter-render, menyalin konten ke clipboard, dan mendownload file `prd.md`.
- **File Terlibat**:
  - `src/components/prd/PrdDrawer.tsx`
  - `src/components/canvas/TopBar.tsx`
- **Kriteria Selesai**:
  - Tombol "Export PRD" di TopBar membuka drawer kanan.
  - Teks Markdown tampil dengan formatting rapi (headings, tabel, code block).
  - Mengklik "Download .md" men-trigger download file `prd.md` di browser.

### **T8: LocalStorage Auto-Save & Reset Flow**
- **Tujuan**: Menyimpan otomatis status kanvas saat ada perubahan dan memberikan tombol "New Plan / Reset" untuk membersihkan kanvas.
- **File Terlibat**:
  - `src/store/useCanvasStore.ts`
  - `src/components/canvas/TopBar.tsx`
- **Kriteria Selesai**:
  - Setelah mengedit kanvas dan me-refresh browser, posisi node dan jawaban yang dipilih tetap ada.
  - Menekan tombol "Reset" menampilkan konfirmasi dan mengembalikan kanvas ke kondisi awal.

---
