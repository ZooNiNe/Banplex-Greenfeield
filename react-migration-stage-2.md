# React Migration Stage 2

## Tujuan

Tahap 2 bukan menambah halaman React baru.

Tahap 2 adalah menstabilkan fondasi migrasi supaya UI bisa dipindah ke React tanpa:

- merusak alur data live
- mengubah kontrak backend / Firestore / server
- mengganggu sync offline / outbox / multi-user
- menciptakan page React yang hanya "kulit React" tetapi tetap bergantung ke DOM legacy

Target utama:

1. Satu jalur state update yang konsisten untuk React.
2. Satu jalur action dispatch yang konsisten untuk React.
3. Form dan modal legacy bisa dipakai sementara lewat adapter yang jelas.
4. Halaman baru React hanya boleh memakai service/data layer yang sudah aman.

## Kondisi Saat Ini

Struktur saat ini masih hybrid:

- shell, router, sync, event bus, Dexie, action handler masih hidup di `js/`
- React baru dipasang per halaman lewat wrapper `js/ui/pages/*.jsx`
- sebagian page React masih mutasi `appState` langsung
- sebagian page React masih emit event yang tidak punya listener final
- sebagian flow masih membaca DOM legacy dari service layer

Risiko utamanya:

1. React tidak benar-benar menjadi UI layer yang deterministik.
2. Multi-user update real-time tidak otomatis menyegarkan page React.
3. Form / komentar / detail action bisa jalan tidak konsisten antar halaman.
4. Migrasi makin jauh tetapi technical debt inti tidak turun.

## Prinsip Implementasi

1. Backend contract tidak diubah.
2. `appState`, Dexie, outbox, sync service tetap dipakai dulu sebagai domain layer transisional.
3. React hanya berbicara ke adapter, bukan ke DOM legacy secara langsung.
4. Event bus tetap dipakai sementara, tetapi event generik dikurangi.
5. Semua perubahan harus aman untuk aplikasi live dan multi-user.
6. Mobile-first: komponen baru harus mengutamakan 1 kolom, thumb reach, dan action yang jelas.

## Arsitektur Target Tahap 2

### 1. React State Bridge

Buat bridge khusus React, misalnya:

- `src/react/bridge/appStateStore.js`
- `src/react/hooks/useAppSelector.js`

Tugas bridge ini:

- subscribe ke event yang memang menandakan perubahan data
- subscribe ke `liveQuery` / `notify` untuk key data penting
- expose snapshot state yang stabil ke React
- mencegah page React melakukan `state.foo = ...` langsung

Aturan:

- React read: lewat selector/store
- React write: lewat action bridge
- service lama boleh tetap menulis ke `appState`, tapi React tidak

### 2. UI Action Bridge

Buat adapter tunggal, misalnya:

- `src/react/bridge/uiActions.js`

Isi minimal:

- `navigate(page, options)`
- `openBillDetail(context)`
- `openPemasukanDetail(context)`
- `openAttendanceModal(context)`
- `openWorkerRecap(context)`
- `openComments(context)`
- `openStockUsage(context)`
- `showToast(payload)`

Aturan:

- page React tidak emit `ui.action` generik
- page React tidak perlu tahu nama event bus internal
- mapping event lama diletakkan di satu tempat

Contoh anti-pattern yang harus dihilangkan:

- `emit('ui.action', { action: 'open-bill-detail', ... })`
- `emit('ui.action', { action: 'open-manual-attendance-modal', ... })`

### 3. Form Bridge

Selama form legacy masih dipakai, pisahkan dua mode:

- `LegacyFormBridge`: React hanya mount container dan lifecycle
- `ReactForm`: form baru murni React

Bridge harus bertanggung jawab pada:

- mount/unmount aman
- cleanup listener
- dirty state
- submit state
- loading state

Yang tidak boleh:

- `innerHTML` acak di banyak komponen React
- attach listener manual tanpa cleanup

### 4. Page Mount Helper

Wrapper `js/ui/pages/*.jsx` sekarang duplikatif.

Buat helper bersama, misalnya:

- `src/react/bridge/mountReactPage.js`

Tugasnya:

- render container shell
- mount `AppProvider`
- unmount root lama
- daftar cleanup `app.unload.<page>`

Manfaat:

- wrapper halaman menjadi tipis
- lifecycle mount/unmount seragam
- kecil kemungkinan root React bocor

## Prioritas Eksekusi

### Prioritas 0: Stabilitas Dasar

Kerjakan dulu sebelum page migration lanjut.

1. Tambahkan init guard untuk `initializeEventListeners()`.
2. Tambahkan init guard untuk `initializeEventBusListeners()`.
3. Samakan key tema ke satu sumber: `banplex_theme`.
4. Hapus pemakaian event `ui.action` generik dari page React.
5. Tambahkan helper mount/unmount React page.

Output tahap ini:

- tidak ada listener dobel
- action React tidak diam
- reload tema konsisten

### Prioritas 1: State Bridge

Kerjakan setelah stabilitas dasar.

1. Buat store React yang subscribe ke event data yang benar.
2. Hubungkan store ke `liveQuery` untuk data yang berubah real-time.
3. Refactor `AppProvider` supaya tidak hanya snapshot dangkal `appState`.
4. Larang mutasi `appState` langsung dari komponen React.

Output tahap ini:

- React rerender saat data real-time berubah
- page React tidak perlu `emit('app.stateChanged')` untuk hal yang semestinya lokal

### Prioritas 2: Action Bridge

1. Tambahkan `uiActions` adapter.
2. Refactor page React yang sudah ada untuk memakai adapter.
3. Simpan semua mapping event lama di adapter, bukan di komponen.

Output tahap ini:

- surface area integrasi turun
- migrasi page berikutnya lebih cepat

### Prioritas 3: Form / Comment Decoupling

1. Perbaiki flow komentar agar service tidak membaca textarea legacy.
2. Pisahkan API comment service menjadi:
   - `createComment(payload)`
   - `editComment(payload)`
   - `deleteComment(payload)`
3. Tambahkan bridge khusus untuk legacy form yang masih pakai HTML generator.

Output tahap ini:

- chat React benar-benar jalan
- form bisa dimigrasikan bertahap

## Klasifikasi Halaman

### Aman Dimigrasikan Setelah Fondasi Jadi

- `dashboard`
- `pengaturan`
- `tagihan`
- `pemasukan`
- `absensi`
- `jurnal`
- `stok`
- `simulasi`

Catatan:

- halaman ini tetap perlu action bridge
- beberapa masih perlu data selector yang lebih rapi

### Perlu Ditahan Sampai Bridge Matang

- `chat`
- `master_data`
- `laporan`

Alasan:

- `chat` masih terikat service komentar legacy
- `master_data` masih inject HTML form legacy ke React
- `laporan` masih meminjam `window.appState.dashboardData` untuk chart helper

### Perlu Audit Ulang Sebelum Dilanjutkan

- `file_storage`
- `hrd_applicants`

Alasan:

- keduanya query Firestore langsung dari page React
- `hrd_applicants` React memakai koleksi yang tidak sesuai dengan flow legacy
- action yang dipakai masih mewarisi namespace file storage
- risk akses data dan rules lebih tinggi

## Acceptance Criteria Tahap 2

Tahap 2 dianggap selesai jika:

1. Tidak ada listener init ganda saat guest -> login -> logout -> login.
2. Semua page React yang aktif memakai action adapter, bukan emit generik.
3. State React ikut refresh saat data berubah dari sync/realtime.
4. Komentar React bisa create/edit/delete tanpa DOM legacy.
5. Theme persist konsisten antar reload.
6. Ada smoke test minimal untuk flow kritis.

## Smoke Test Minimum

Sebelum migrasi page baru, minimal harus ada verifikasi untuk:

1. login dan restore session
2. navigasi antar halaman React dan legacy
3. create/update/delete data dari halaman React
4. sync offline -> online
5. update dari user lain muncul di page aktif
6. open/close modal, detail pane, back button mobile
7. chat/comment create/edit/delete

## Urutan Implementasi yang Disarankan

Urutan paling aman:

1. Stabilitas dasar
2. state bridge
3. action bridge
4. comment decoupling
5. page wrapper helper
6. refactor page React yang sudah ada
7. baru tambah halaman/form React baru

## Larangan Selama Tahap 2

Jangan lakukan ini dulu:

- refactor backend / struktur koleksi Firestore
- ubah kontrak sync/outbox
- pindahkan semua form sekaligus
- migrasi page baru sebelum bridge selesai
- biarkan page React query Firestore langsung tanpa alasan kuat

## Deliverable Tahap 2

Kalau dikerjakan penuh, hasil akhirnya harus berupa:

1. bridge state React
2. bridge action React
3. helper mount page React
4. comment service yang tidak bergantung ke DOM
5. penghapusan listener init ganda
6. normalisasi theme persistence
7. smoke test minimal

## Rekomendasi Tahap 2.1

Langkah implementasi pertama yang paling bernilai:

1. pasang guard listener init
2. buat `uiActions` adapter
3. refactor 3 page termudah dulu:
   - `SettingsPage`
   - `BillsPage`
   - `PemasukanPage`
4. perbaiki `ChatPage` + `commentService`

Setelah itu baru lanjut ke:

- `AttendancePage`
- `JurnalPage`
- `StockPage`

## Catatan Build

Build produksi saat audit ini masih lolos, tetapi bundle masih berat untuk mobile.

Konsekuensinya:

- tahap 2 boleh fokus dulu ke correctness
- optimasi chunking bisa jadi tahap 3 setelah integrasi state/action stabil
