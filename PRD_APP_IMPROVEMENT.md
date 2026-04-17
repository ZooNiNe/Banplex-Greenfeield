# Project Requirements Document (PRD): Banplex App Improvement & React Migration Completion

## 1. Executive Summary
**Tujuan Proyek:** Menyelesaikan transisi arsitektur aplikasi Banplex dari status "Hybrid Vanilla-React" menjadi aplikasi React murni (Native-Feel) yang modern, stabil, dan memiliki performa tinggi. 
Fokus utama adalah pada **pembenahan State Management**, **penghapusan technical debt (circular dependencies)**, dan **Peningkatan UI/UX untuk pengguna non-akuntan**, tanpa menyentuh core logic database atau backend service.

## 2. Hasil Audit Sistem Saat Ini (Current State Audit)
Berdasarkan investigasi pada repositori (`js/report/`, `plans/`, `docs/progress/`, dan kode sumber), aplikasi saat ini berada pada **Fase 4 dari 8** dalam rencana migrasi state.

**Kondisi Positif:**
- ~85% fungsi inti (Dashboard, Settings, Stock, dll.) sudah dimigrasi ke komponen React 19.
- Sistem UI sudah mengadopsi konsep "Native-Feel" dengan Glassmorphism dan kepatuhan terhadap safe-area mobile.

**Masalah & Blocker Utama (Technical Debt):**
1. **Dual State Ownership (Redundansi State):** Aliran data saat ini sangat panjang: `Firestore -> Sync Service -> Dexie -> Vanilla appState -> Zustand Store`. Hal ini menciptakan latensi dan kompleksitas pemeliharaan.
2. **Layering Violations (Pelanggaran Arsitektur):** Modul utilitas seperti `js/utils/ui.js` dan `js/utils/form.js` mengimpor logika dari layer halaman di atasnya (L4). Ini menyebabkan *cyclical dependencies* (ketergantungan memutar) yang membuat proses build menjadi rentan/fragile.
3. **Ketergantungan pada EventBus Legacy:** Komponen React masih memancarkan event `ui.action` gaya lama.
4. **State Implisit:** Banyak key state yang dibuat secara dinamis saat runtime, sehingga tidak ada *type safety* dan bentuk state sulit diprediksi.

## 3. Scope of Work (Ruang Lingkup Pengembangan)

Pengembangan selanjutnya akan dibagi menjadi 4 inisiatif utama:

### Inisiatif 1: Unifikasi State Management (Zustand Full Ownership)
- **Tujuan:** Menghapus `js/state/appState.js` (Legacy) dan menjadikan Zustand Store (`src/react/store/appStateStore.js`) sebagai *Single Source of Truth*.
- **Tugas:**
  - Migrasi *listener* Dexie LiveQuery langsung ke dalam Zustand actions/hooks.
  - Memutus jembatan sinkronisasi (`legacyAppStateBridge.js`) setelah semua komponen React mandiri mengambil data dari Zustand.
  - Formalisasi schema state agar eksplisit dan terprediksi.

### Inisiatif 2: Deprekasi Legacy EventBus
- **Tujuan:** Mengganti komunikasi komponen berbasis *event emitter* (`eventBus.js`) dengan aliran data React yang idiomatis.
- **Tugas:**
  - Ubah trigger `ui.action` pada komponen React menjadi pemanggilan langsung *Zustand actions* atau fungsi dari React Context.
  - Pastikan modul non-UI (services) menggunakan callback atau *store subscription* ketimbang melempar event global.

### Inisiatif 3: Refactoring Hygiene & Penghapusan Cyclical Dependency
- **Tujuan:** Membersihkan utilitas agar proses bundel (Vite) stabil.
- **Tugas:**
  - Lakukan *hygiene pass* pada direktori `js/utils/`. Ekstrak fungsi-fungsi murni (pure functions) agar tidak mengimpor dari layer UI (halaman/pages).
  - Pindahkan fungsi spesifik UI dari *utils* ke dalam direktori komponen React yang sesuai.

### Inisiatif 4: Penyempurnaan UI/UX & "Zero Jargon"
- **Tujuan:** Menyempurnakan pengalaman pengguna agar terasa seperti aplikasi native dan ramah pengguna awam.
- **Tugas:**
  - **Zero Jargon Policy:** Ganti semua istilah akuntansi teknis di UI dengan bahasa umum (misal: "Kredit" menjadi "Uang Masuk", "Debit" menjadi "Uang Keluar").
  - **Native Touch:** Pastikan integrasi `@capacitor/haptics` berjalan pada setiap interaksi tombol/kartu utama.
  - **Animasi Transisi:** Implementasi `framer-motion` untuk semua transisi halaman, pembukaan modal, dan *pull-to-refresh*.
  - **Safe Area:** Verifikasi penggunaan variabel CSS `env(safe-area-inset-*)` pada perangkat berponi (notch) di semua tampilan baru.

## 4. Constraint & Aturan Emas (Sesuai `GEMINI.md`)
1. **STRICT DATA ISOLATION:** Dilarang keras memodifikasi file di dalam direktori `js/services/`, `api/`, atau skema database di `localDbService.js`.
2. **Surgical UI Refactoring:** Semua perubahan hanya boleh terjadi pada `src/react/`, `js/ui/`, dan `styles/`.
3. **Backward Compatibility:** Perubahan tidak boleh memutus logika *engine* backend produksi. Layanan sinkronisasi latar belakang harus tetap berjalan normal.

## 5. Kriteria Penerimaan (Acceptance Criteria)
- Tidak ada error *circular dependency* saat menjalankan `npm run build`.
- Semua interaksi UI utama memicu umpan balik *haptic* dan animasi transisi halus.
- `appState.js` legacy berhasil dinonaktifkan tanpa ada regresi data pada halaman Dashboard dan Laporan.
- Review manual membuktikan tidak ada istilah teknis akuntansi pada *interface* pengguna.