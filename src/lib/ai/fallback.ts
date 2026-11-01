import type { QuestionItem } from "./prompts";

/**
 * Returns contextual fallback mock questions if the AI proxy is unreachable or encounters an error.
 */
export function getFallbackQuestions(idea: string): QuestionItem[] {
  const normalized = idea.toLowerCase();

  // If idea is related to shoe cleaning / marketplace / laundry
  if (
    normalized.includes("sepatu") ||
    normalized.includes("cuci") ||
    normalized.includes("marketplace") ||
    normalized.includes("jasa")
  ) {
    return [
      {
        id: "q-logistics-model",
        category: "MVP Scope",
        question: "Bagaimana skema penanganan logistik (antar-jemput sepatu) antara pelanggan dan workshop mitra?",
        suggestions: [
          "Drop-off mandiri (pelanggan antar & ambil sendiri ke outlet mitra)",
          "Integrasi kurir instan on-demand (GoSend / GrabExpress / Lalamove)",
          "Kurir internal yang disediakan oleh masing-masing mitra cuci",
          "Kurir terpusat armada platform marketplace",
        ],
      },
      {
        id: "q-monetization",
        category: "Monetisasi",
        question: "Bagaimana model monetisasi dan alur pembayaran utama pada tahap awal?",
        suggestions: [
          "Komisi per transaksi (take-rate 10-15%) via payment gateway otomatis",
          "Biaya langganan bulanan (subscription listing) untuk mitra",
          "Pembayaran manual transfer / QRIS ke rekening escrow platform",
          "Freemium dengan biaya promosi berbayar (featured merchant)",
        ],
      },
      {
        id: "q-platform-interfaces",
        category: "Platform",
        question: "Antarmuka (interfaces) apa saja yang wajib disediakan untuk rilis MVP?",
        suggestions: [
          "Web Responsive untuk pelanggan + Dashboard Web untuk mitra",
          "Web Pelanggan saja (penerimaan pesanan mitra diteruskan via WhatsApp)",
          "Progressive Web App (PWA) untuk pelanggan dan mitra toko",
          "Web Portal Pelanggan + Dashboard Admin terpadu",
        ],
      },
      {
        id: "q-tech-stack",
        category: "Tech Stack",
        question: "Fondasi teknologi apa yang dipilih untuk kecepatan rilis dan kemudahan skalabilitas?",
        suggestions: [
          "Next.js 14 (App Router) + Tailwind CSS + Supabase / PostgreSQL",
          "React (Vite) + Node.js (Express) + MongoDB",
          "Laravel + Livewire / Tailwind CSS (Monolith cepat kembang)",
        ],
      },
    ];
  }

  // Generic fallback for any other project idea
  return [
    {
      id: "q-target-platform",
      category: "Platform",
      question: "Platform apa yang menjadi target utama pengguna pada versi MVP?",
      suggestions: [
        "Web Responsive Desktop & Mobile (Mobile-first)",
        "Aplikasi Mobile Lintas Platform (iOS & Android via React Native/Expo)",
        "Progressive Web App (PWA)",
      ],
    },
    {
      id: "q-architecture-stack",
      category: "Tech Stack",
      question: "Fondasi arsitektur dan database apa yang ingin digunakan?",
      suggestions: [
        "Next.js 14 App Router + Tailwind CSS + PostgreSQL",
        "React (Vite) SPA + REST API Backend (Node.js/Express)",
        "Monolith Framework (Laravel / Django) + Tailwind",
      ],
    },
    {
      id: "q-core-scope",
      category: "MVP Scope",
      question: "Fitur utama apa yang paling krusial untuk divalidasi pada peluncuran pertama?",
      suggestions: [
        "Core Workflow & User Self-Service Dashboard",
        "Katalog Publik dengan Sistem Transaksi / Pemesanan Langsung",
        "Integrasi Otomatisasi AI & Export Data",
      ],
    },
    {
      id: "q-auth-payment",
      category: "Monetisasi & Akses",
      question: "Bagaimana mekanisme autentikasi dan monetisasi pengguna di awal?",
      suggestions: [
        "Free Access tanpa autentikasi (Simpan ke LocalStorage)",
        "Autentikasi Pengguna (Social Login Google / GitHub) + Akses Gratis",
        "Autentikasi Pengguna + Payment Gateway / Pembayaran Berlangganan",
      ],
    },
  ];
}
