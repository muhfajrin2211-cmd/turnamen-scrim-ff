# 🎮 PAPIH GAMING - SISTEM TURNAMEN & SCRIM FREE FIRE
### Otomatisasi QRIS DANA (0% Potongan) + MacroDroid Notification Hook

Sistem pendaftaran turnamen mandiri tanpa Firebase, tanpa Google Sheets, dan tanpa biaya potongan payment gateway (0% fee). Menggunakan QRIS Dinamis DANA Toko (**ZONA OUTDOOR**) dan pembacaan notifikasi real-time dari HP Android via **MacroDroid**.

---

## 📂 Struktur File Utama

| File | Keterangan |
|---|---|
| [`index.html`](file:///d:/DATA%20BASE%20TESTING/index.html) | Halaman Formulir Pendaftaran Peserta (Input Nama Tim, Nick, WA, Logo, Sesi, Bayar QRIS Dinamis, dan Auto Redirect Grup WhatsApp). |
| [`admin.html`](file:///d:/DATA%20BASE%20TESTING/admin.html) | Dashboard Admin Panel (Kelola Sesi & Link Grup WhatsApp per jam sesi, Data Tim Pendaftar Realtime, Lunas Manual, Log Notifikasi HP). |
| [`database.json`](file:///d:/DATA%20BASE%20TESTING/database.json) | Database lokal untuk menyimpan sesi, link grup WA, pendaftar, dan riwayat mutasi DANA. |
| [`server.ps1`](file:///d:/DATA%20BASE%20TESTING/server.ps1) | Backend server lokal ringan berbasis PowerShell (melayani web dan webhook MacroDroid). |
| [`START_SERVER.bat`](file:///d:/DATA%20BASE%20TESTING/START_SERVER.bat) | File shortcut klik 2x untuk langsung menyalakan server kapan saja. |

---

## 🚀 Cara Menjalankan Sistem

1. Klik 2x file **`START_SERVER.bat`** (atau jalankan `server.ps1`).
2. Buka di Browser Anda:
   * **Dashboard Admin**: [`http://localhost:8080/admin`](http://localhost:8080/admin)
   * **Form Pendaftaran**: [`http://localhost:8080`](http://localhost:8080)

---

## 📱 Cara Setting MacroDroid di HP Android

Agar notifikasi transfer DANA otomatis mengubah status tim jadi **LUNAS** (bisa bekerja dari mana saja, bahkan pakai kuota 4G tanpa harus satu Wi-Fi):

1. Buka aplikasi **MacroDroid** di HP Android Anda.
2. Buat Makro baru:
   * **Pemicu (Triggers - Warna Merah):**
     - Pilih: *Peristiwa Perangkat (Device Events)* $\rightarrow$ *Notifikasi (Notification)* $\rightarrow$ *Notifikasi Diterima*.
     - Pilih Aplikasi: Centang aplikasi **DANA**.
     - Teks: Pilih *Apa Saja (Any content)*.
   * **Tindakan (Actions - Warna Biru):**
     - Klik ikon cari 🔍 $\rightarrow$ Ketik `HTTP` $\rightarrow$ Pilih **Permintaan HTTP (HTTP Request)**.
     - **Metode:** `GET`
     - **URL:** 
       ```text
       https://script.google.com/macros/s/AKfycbzTfUGVc42_wqFYcJAySu2P8AmROGbG-QdFcKpgFOoASvRC41LCBHVhSUl4Absn5NiV/exec?action=notif&text=[notif_text]
       ```
       *(Sudah langsung terhubung ke Google Apps Script Anda).*
3. Simpan dan aktifkan Makro.

---

## ⚙️ Mengatur Link Grup WhatsApp Per Jam Sesi

1. Masuk ke [`http://localhost:8080/admin`](http://localhost:8080/admin) (Sandi default: `papihadmin2026`).
2. Di tab **Pengelola Sesi & Link Grup WA**, terdapat 15 sesi (Jam 10.00, 11.00, 12.00, 13.00, 14.00, 15.00, 16.00, 17.00, 19.00, 20.00, 21.00, 22.00, 23.00, 00.00 Midnight, 01.00 Late Night).
3. Anda bisa mengaktifkan/menyembunyikan sesi, mengganti link grup WhatsApp masing-masing jam, lalu klik tombol: **`SIMPAN PERUBAHAN SESI & LINK GRUP`**.
4. Kapan pun ada tim yang membayar untuk sesi jam tersebut, mereka akan langsung otomatis diarahkan ke link grup jam yang mereka pilih!
