# UI/UX Planning & Blueprint

Target platform: Telegram Mini App mobile webview
Scope: global polish planning only, no UI implementation in this phase

## A. App Navigation Flow

### Design direction

- Navigation harus pendek, satu tangan, dan bisa dipahami tanpa onboarding tambahan.
- Halaman yang sering dipakai harus maksimal 1 tap dari dashboard.
- Aksi input transaksi tidak boleh tersebar di banyak tombol vertikal.
- Master data dan pengaturan dipindahkan ke area utilitas agar dashboard fokus ke kerja harian.

### Proposed navigation structure

#### Option recommended: Bottom Navigation Bar

1. `Beranda`
   Menampilkan ringkasan saldo, laba konsolidasi, shortcut aksi cepat, dan Unified Transaction List.
2. `Transaksi`
   Menampilkan daftar mutasi terpadu full-screen dengan filter jenis, proyek, status, dan tanggal.
3. `Proyek`
   Menampilkan daftar proyek, performa proyek, status tagihan, dan breakdown keuangan.
4. `Master`
   Menampilkan Universal Master Data Manager untuk proyek, pekerja, supplier, material, profesi, staff, dan HRD.
5. `Lainnya`
   Menampilkan tim, pengaturan PDF, beneficiaries, undangan tim, dan utilitas admin lain.

### Screen flow

```text
Masuk App
  -> Beranda
     -> Quick Action: Pemasukan
     -> Quick Action: Pengeluaran
     -> Quick Action: Absensi/Gaji
     -> Quick Action: Pinjaman/Dana
     -> Tap item mutasi -> Detail transaksi
     -> Tap kartu saldo/laba -> Laporan

Bottom Nav
  -> Transaksi
     -> Filter
     -> Detail transaksi
     -> Edit / Soft delete

  -> Proyek
     -> Detail proyek
     -> Laporan proyek
     -> Riwayat pemasukan / biaya / gaji

  -> Master
     -> Tab entitas
     -> Add / Edit / Soft delete

  -> Lainnya
     -> Team Invite Manager
     -> Team Active List
     -> PDF Settings
     -> Beneficiaries
     -> HRD Pipeline
```

### Information architecture rules

- Beranda tidak boleh memuat teks dummy, placeholder lorem, atau panel kosong dekoratif.
- Beranda hanya berisi data ringkas yang bisa di-scan dalam 3 detik.
- Semua daftar panjang dipindahkan ke layar spesifik, bukan dijejalkan di dashboard.
- Action utama harus konsisten urutannya: `Pemasukan`, `Pengeluaran`, `Gaji`, `Pinjaman`, `Master`, `Tim`.

## B. ASCII Wireframe: Dashboard Utama

### Layout goals

- Header setinggi mungkin ringkas.
- Action buttons horizontal dalam grid 2 atau 3 kolom.
- Tidak ada tombol besar bertumpuk ke bawah.
- Unified Transaction List menjadi komponen utama setelah ringkasan atas.

```text
+--------------------------------------------------+
| Hai, Andi                              11 Apr    |
| Saldo Kas  Rp12,4jt   Laba Bersih  Rp3,1jt       |
+--------------------------------------------------+
| [ + Pemasukan ] [ + Pengeluaran ] [ + Gaji ]     |
| [ + Pinjaman  ] [ Master Data   ] [ Tim & Invite]|
+--------------------------------------------------+
| Filter Cepat: [Semua] [Hari ini] [Proyek] [Cari] |
+--------------------------------------------------+
| Mutasi Terpadu                                   |
|--------------------------------------------------|
| [T] Termin Proyek A            +Rp8.000.000      |
|     10:12  Utama  Lunas                           |
|--------------------------------------------------|
| [M] Faktur Material Proyek A   -Rp2.500.000      |
|     09:40  Supplier Sinar Jaya                   |
|--------------------------------------------------|
| [S] Rekap Gaji Mingguan         -Rp1.200.000     |
|     08:10  6 pekerja  Outstanding                |
|--------------------------------------------------|
| [P] Pinjaman Operasional        +Rp3.000.000     |
|     07:32  Kreditor Internal                     |
|--------------------------------------------------|
| [J] Surat Jalan Material        stok keluar      |
|     07:05  Proyek Internal Gudang                |
|--------------------------------------------------|
| [Lihat semua mutasi]                              |
+--------------------------------------------------+
| Bottom Nav: [Beranda] [Transaksi] [Proyek]       |
|             [Master] [Lainnya]                   |
+--------------------------------------------------+
```

### Unified transaction list rules

- Satu list kronologis lintas modul, bukan beberapa card daftar terpisah.
- Setiap item punya penanda visual konsisten:
  - `T` untuk termin/pemasukan
  - `M` untuk material/faktur
  - `S` untuk gaji
  - `P` untuk pinjaman/dana
  - `J` untuk surat jalan/stok keluar
- Warna dipakai hanya sebagai aksen status, bukan sebagai blok background besar.
- Baris kedua item selalu berisi konteks singkat: waktu, proyek, lawan transaksi, status.
- Nilai uang rata kanan agar mudah discan.
- Mutasi non-kas seperti surat jalan wajib tetap muncul, tapi diberi label `stok keluar` atau `non-cash`.

## C. ASCII Wireframe: Universal Modal / Form

### Layout goals

- Modal hemat tinggi layar, cocok untuk webview Telegram.
- Label kecil dan rapat.
- Footer aksi selalu dua tombol horizontal.
- Untuk form panjang, gunakan section tipis dan sticky footer.

```text
+----------------------------------------------+
| Edit Data                             [x]    |
|----------------------------------------------|
| Nama                                       | |
| [ PT Sinar Jaya                          ] | |
|                                              |
| Kategori                                   | |
| [ Supplier Material                  v    ] | |
|                                              |
| Nomor Telepon                              | |
| [ 08xxxxxxxxxx                           ] | |
|                                              |
| Catatan                                    | |
| [ ...................................... ] | |
| [ ...................................... ] | |
|----------------------------------------------|
| [ Batal ]                      [ Simpan ]    |
+----------------------------------------------+
```

### Form standards

- Label memakai `text-xs` atau `text-sm`, bukan heading besar.
- Input padding vertikal tipis agar 4 sampai 6 field tetap nyaman dalam satu layar.
- Jarak label ke input `gap-1`.
- Jarak antar field `gap-2`.
- Tombol primer dan sekunder selalu sejajar horizontal.
- Modal maksimal memakai header, body, sticky footer. Hindari banyak card di dalam modal.

### Special case: relational form

Untuk form seperti pekerja dengan upah per proyek:

```text
+----------------------------------------------+
| Pekerja Baru                          [x]    |
|----------------------------------------------|
| Nama                                       | |
| [ Budi Santoso                           ] | |
| Profesi                                    | |
| [ Tukang Las                         v    ] | |
|----------------------------------------------|
| Upah per Proyek                             |
| [ Proyek A      ][ Role      ][ Nominal ]   |
| [ Proyek B      ][ Role      ][ Nominal ]   |
| [ + Tambah Relasi Upah ]                    |
|----------------------------------------------|
| [ Batal ]                      [ Simpan ]    |
+----------------------------------------------+
```

## D. Design Tokens (Panduan Tailwind)

### Container and spacing

- Main app wrapper:
  - `px-2 py-2` untuk layar sempit
  - `px-3 py-3` untuk layar standar
- Inner section spacing:
  - `gap-2`
  - `space-y-2`
- Card padding:
  - default `p-3`
  - compact `p-2`
- Grid gap action buttons:
  - `gap-2`

### Typography scale

- Page title: `text-lg font-semibold`
- Section title: `text-sm font-semibold`
- Body standard: `text-sm`
- Secondary meta: `text-xs`
- Numeric KPI: `text-base font-semibold`
- Hindari `text-2xl` dan `text-3xl` pada dashboard mobile kecuali layar laporan penuh.

### Layout utilities

- Root main container:
  - hindari `p-4`, `p-6`, `gap-4`, `gap-6`
  - standar baru `p-2 md:p-3`
- Header rows:
  - `flex items-center justify-between gap-2`
- Quick actions:
  - `grid grid-cols-2 gap-2`
  - naik ke `grid-cols-3` bila aksi utama berjumlah 6
- Form rows:
  - `flex flex-col gap-1`
- Modal footer:
  - `grid grid-cols-2 gap-2`

### Component rhythm

- Card ke card: maksimal `gap-2`
- Label ke input: `mb-1`
- List item vertical padding: `py-2`
- Hindari nested cards dengan padding berlapis.
- Divider tipis lebih baik daripada whitespace besar untuk memisahkan blok data.

### Visual behavior

- Gunakan satu background dasar dengan elevasi ringan pada card penting.
- Kurangi border tebal dan shadow besar.
- Status menggunakan badge kecil, bukan panel warna penuh.
- Empty state harus singkat dan fungsional, misalnya `Belum ada transaksi hari ini`.

## Execution notes for next UI refactor

- Mulai dari `#root > main` untuk memangkas padding global.
- Refactor dashboard terlebih dahulu sebelum halaman detail.
- Satukan seluruh sumber mutasi ke komponen list terpadu sebelum memoles visual dekoratif.
- Bersihkan dummy text dan placeholder lama sebelum menambah komponen baru.
