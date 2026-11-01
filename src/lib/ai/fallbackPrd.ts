import { normalizeAnswers, type NormalizedAnswer } from "./prdPrompt";

/**
 * Generates a complete, high-quality fallback Markdown PRD when upstream AI is unreachable.
 * Follows the standard ngePRD structure and incorporates user's idea and planning choices.
 */
export function generateFallbackPrd(idea: string, answersInput?: unknown): string {
  const answers = normalizeAnswers(answersInput);

  // Extract relevant user choices if present
  const findAnswer = (keywords: string[]): string | undefined => {
    return answers.find((a) => {
      const text = `${a.category || ""} ${a.question || ""} ${a.answer}`.toLowerCase();
      return keywords.some((k) => text.includes(k.toLowerCase()));
    })?.answer;
  };

  const techStackAnswer =
    findAnswer(["tech stack", "teknologi", "arsitektur", "framework", "next.js", "react"]) ||
    "Next.js 14 (App Router) + TypeScript + Tailwind CSS";

  const platformAnswer =
    findAnswer(["platform", "target", "web", "mobile", "ios", "android"]) ||
    "Web Responsive (Desktop & Mobile-first)";

  const scopeAnswer =
    findAnswer(["scope", "mvp", "fitur", "logistik", "alur"]) ||
    "Core Workflow & User Self-Service Experience";

  const storageAnswer =
    findAnswer(["storage", "database", "penyimpanan", "localstorage", "supabase"]) ||
    "Browser LocalStorage / IndexedDB (Zero Cloud Database Cost)";

  const cleanIdea = idea.trim() || "Aplikasi Web Digital Modern";

  return `# Product Requirement Document (PRD)

# 1. Ringkasan
**${cleanIdea}** adalah solusi digital yang dirancang untuk mengatasi hambatan pengguna dengan menyediakan alur kerja yang intuitif, cepat, dan terarah. Produk ini berfokus pada pengalaman pengguna yang mulus pada versi Minimum Viable Product (MVP), memungkinkan pengguna mencapai tujuan intinya tanpa kompleksitas konfigurasi yang berlebihan.

# 2. Masalah & Tujuan
- **Masalah**: Pengguna sering kesulitan menyelesaikan alur kerja secara efisien akibat keterbatasan alat yang ada, proses manual yang repetitif, serta antarmuka yang kurang terstruktur.
- **Tujuan**: Menghadirkan platform digital berbasis ${platformAnswer} yang mempermudah eksekusi alur utama pengguna dengan kecepatan respons tinggi dan pengalaman visual yang bersih.
- **Definisi Berhasil**: Pengguna dapat menyelesaikan alur utama produk (${scopeAnswer}) dari awal hingga akhir dalam waktu kurang dari 5 menit tanpa bantuan teknis manual.

# 3. Di Luar Scope (Out of Scope untuk MVP)
- Sistem Autentikasi Kompleks Multi-Role (Enterprise SSO, RBAC bertingkat).
- Integrasi Payment Gateway Otomatis multi-channel (ditunda ke fase pasca-MVP).
- Sinkronisasi Cloud Realtime Multi-User (Multiplayer live collaboration).
- Analitik tingkat lanjut dan dashboard pelaporan kustom.
- Dukungan aplikasi native platform sekunder di luar ${platformAnswer}.

# 4. Pengguna & Skenario Penggunaan
- **Target Pengguna**: Pengguna individu, solo creator, atau profesional yang membutuhkan solusi terarah untuk ${cleanIdea}.
- **Alur Utama (Happy Path)**:
  1. Pengguna membuka aplikasi dan langsung melihat halaman kerja utama yang bersih.
  2. Pengguna memasukkan data awal atau preferensi konfigurasi sesuai kebutuhan.
  3. Sistem memproses input dan menyajikan visualisasi atau langkah kerja terarah.
  4. Pengguna meninjau, mengkustomisasi, dan mengonfirmasi hasil proses.
  5. Pengguna mengekspor atau menyimpan hasil kerja ke perangkat lokal atau format siap pakai.

# 5. Daftar Fitur

| ID | Fitur | Prioritas | Kriteria Selesai |
| :--- | :--- | :--- | :--- |
| **FEAT-01** | Antarmuka Kerja Utama | **MVP** | Halaman responsif dengan tata letak modern, navigasi intuitif, dan state reaktif. |
| **FEAT-02** | Pengaturan Input Konfigurasi | **MVP** | Form atau kartu interaktif untuk menangkap parameter inti pengguna dengan validasi langsung. |
| **FEAT-03** | Engine Pemrosesan Data Inti | **MVP** | Logika pemrosesan yang mengubah data input menjadi rencana/output terstruktur. |
| **FEAT-04** | State Management Reaktif | **MVP** | Sinkronisasi status data antarmuka secara instan tanpa reload halaman penuh. |
| **FEAT-05** | Ekspor & Pratinjau Output | **MVP** | Komponen preview interaktif dengan opsi copy ke clipboard dan download file hasil kerja. |
| **FEAT-06** | Local Storage Persistence | **MVP** | Penyimpanan riwayat dan status kerja ke browser storage agar tidak hilang saat refresh. |
| **FEAT-07** | Sinkronisasi Cloud & Multi-Akun | Nanti | Penyimpanan data ke database cloud terpusat dan manajemen profil pengguna. |

# 6. Alur & Kasus Khusus
- **Kondisi Offline / Koneksi Terputus**: Sistem tetap dapat beroperasi secara lokal menggunakan cached data di browser storage.
- **Kondisi Input Kosong / Tidak Valid**: Tampilkan peringatan visual yang jelas di samping input yang relevan dan cegah aksi lanjut hingga data valid.
- **Error Pemrosesan / Timeout**: Sediakan pesan feedback ramah pengguna beserta tombol "Coba Lagi" tanpa menghilangkan data yang sudah dimasukkan.

# 7. Kebutuhan Teknis
- **Platform**: ${platformAnswer}
- **Frontend Stack**: ${techStackAnswer}
- **State Management & Layout**: Zustand, Tailwind CSS, Lucide Icons
- **Penyimpanan Data MVP**: ${storageAnswer}
- **Batasan Biaya**: $0 (Memanfaatkan free-tier hosting dan infrastruktur serverless)

# 8. Tahapan Pengerjaan (Milestones)
- **Milestone 1**: Inisialisasi arsitektur proyek, konfigurasi Tailwind, dan layout dasar (Estimasi: 3-4 jam).
- **Milestone 2**: Implementasi komponen UI inti dan alur state management (Estimasi: 4-5 jam).
- **Milestone 3**: Integrasi pemrosesan logika bisnis dan validasi data (Estimasi: 4-5 jam).
- **Milestone 4**: Pembuatan fitur preview output dan utilitas ekspor (Estimasi: 3-4 jam).
- **Milestone 5**: Penyempurnaan offline persistence, uji coba UX, dan deployment (Estimasi: 2-3 jam).

# 9. Asumsi & Pertanyaan Terbuka
- \`[ASUMSI]\` Pengguna mengutamakan kecepatan eksekusi dan kesederhanaan alur daripada kustomisasi parameter tingkat lanjut pada fase awal.
- \`[ASUMSI]\` Penyimpanan lokal di browser sudah mencukupi untuk kebutuhan validasi MVP tahap pertama.
- \`[PERTANYAAN TERBUKA]\` Kapan integrasi cloud database perlu diaktifkan berdasarkan metrik jumlah pengguna aktif harian?

---

# Daftar Task untuk Agent Coding

Pekerjaan dipecah menjadi task-task kecil berurutan yang masing-masing dapat langsung dijalankan dan diverifikasi:

### **T1: Project Initialization & Core Layout Setup**
- **Tujuan**: Menyiapkan kerangka kerja ${techStackAnswer} dengan konfigurasi Tailwind CSS dan layout dasar responsif.
- **File Terlibat**:
  - \`package.json\`
  - \`src/app/layout.tsx\`
  - \`src/app/page.tsx\`
- **Kriteria Selesai**:
  - Jalankan \`npm run dev\`. Buka \`http://localhost:3000\`.
  - Halaman utama merender antarmuka bersih tanpa error konsol atau warning linting.

### **T2: State Store & Data Models Configuration**
- **Tujuan**: Membangun modul state management terpusat untuk menyimpan input pengguna, status alur kerja, dan hasil eksekusi.
- **File Terlibat**:
  - \`src/types/index.ts\`
  - \`src/store/useAppStore.ts\`
- **Kriteria Selesai**:
  - State store dapat menginisialisasi nilai default, memperbarui data secara reaktif, dan merefleksikan perubahan ke UI.

### **T3: Interactive Workflow Components**
- **Tujuan**: Membuat komponen interaktif untuk menangkap data konfigurasi pengguna dengan validasi form yang jelas.
- **File Terlibat**:
  - \`src/components/workflow/InputSection.tsx\`
  - \`src/components/workflow/CardOption.tsx\`
- **Kriteria Selesai**:
  - Pengguna dapat memilih opsi atau mengetikkan input kustom dan melihat feedback visual aktif.

### **T4: Core Processing & Synthesis Engine**
- **Tujuan**: Mengimplementasikan engine pemrosesan yang menyusun data terstruktur menjadi dokumen keluaran yang komprehensif.
- **File Terlibat**:
  - \`src/lib/engine/synthesize.ts\`
  - \`src/app/api/synthesize/route.ts\`
- **Kriteria Selesai**:
  - Mengirim payload data menghasilkan output terstruktur yang valid dan lengkap.

### **T5: Output Preview & Export Utility**
- **Tujuan**: Menyediakan drawer atau modal untuk mempratinjau hasil, menyalin ke clipboard, dan mengunduh file dokumen.
- **File Terlibat**:
  - \`src/components/preview/OutputDrawer.tsx\`
  - \`src/lib/export/download.ts\`
- **Kriteria Selesai**:
  - Tombol "Copy" menyalin dokumen dengan feedback toast; tombol "Download" mengunduh file secara lokal.

### **T6: Local Persistence & Reset Workflow**
- **Tujuan**: Menyimpan otomatis status kerja ke browser storage dan menyediakan alur reset yang aman.
- **File Terlibat**:
  - \`src/store/useAppStore.ts\`
  - \`src/components/ui/ResetDialog.tsx\`
- **Kriteria Selesai**:
  - Me-refresh browser mempertahankan seluruh konfigurasi pengguna; tombol reset mengembalikan ke kondisi awal setelah konfirmasi.
`;
}
