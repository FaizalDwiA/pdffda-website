# Client-Side PDF Utility Suite (All-in-One PDF Tool)

PDF Workspace adalah aplikasi web modern all-in-one untuk memanipulasi dokumen PDF secara instan dan aman. Aplikasi ini berjalan **100% di sisi klien (client-side)** tanpa server, tanpa API eksternal, dan tanpa mengunggah berkas apa pun ke internet.

Dengan memproses dokumen secara lokal di dalam browser Anda menggunakan pustaka tangguh, kami menjamin privasi data penuh dan keamanan mutlak untuk semua berkas sensitif Anda.

---

## 🚀 Fitur Utama

1. **Gabung PDF (Merge PDF)**
   - Unggah beberapa berkas PDF sekaligus.
   - Antarmuka daftar yang informatif menampilkan ukuran berkas dan jumlah halaman asli.
   - Atur urutan dokumen secara manual menggunakan tombol Naik/Turun secara real-time.
   
2. **Pisah & Hapus Halaman (Split & Delete Pages)**
   - Unggah satu berkas PDF tunggal untuk melihat semua lembaran halamannya secara visual.
   - Dilengkapi rendering pratinjau halaman berbasis Canvas yang cepat dan aman.
   - Seleksi halaman interaktif: Klik halaman untuk memilih, dilengkapi tombol bantuan (Pilih Semua, Kosongkan, Balikkan).
   - Dua metode keluaran:
     - **Ekstrak Halaman Terpilih**: Membuat berkas PDF baru yang hanya berisi halaman yang Anda pilih.
     - **Hapus Halaman Terpilih**: Membuat berkas PDF baru dengan menghapus halaman yang Anda pilih dari dokumen asli.

3. **Gambar ke PDF (Images to PDF)**
   - Unggah banyak gambar sekaligus (mendukung format JPG, JPEG, PNG).
   - Pengaturan layout kustom lengkap:
     - Ukuran Kertas: A4 atau Letter.
     - Orientasi: Potret (Portrait) atau Lansekap (Landscape).
     - Margin: Tanpa Margin, Margin Tipis (12px), atau Margin Lebar (24px).
   - Preview visual dengan kemampuan mengurutkan urutan gambar (Pindah Kiri/Kanan) sebelum kompilasi dilakukan.

---

## 🔒 Jaminan Keamanan & Privasi

- **Tanpa Unggah Server**: Semua kompilasi biner PDF dikerjakan 100% di browser RAM lokal Anda menggunakan pustaka JavaScript `pdf-lib` dan `pdfjs-dist`.
- **Dukungan Offline**: Karena diproses di sisi klien, aplikasi ini dapat beroperasi penuh bahkan saat komputer Anda tidak terhubung ke jaringan internet (luring).
- **Zero Limit**: Tanpa batas ukuran dokumen per hari, tanpa batas antrean halaman, dan tanpa tanda air (watermark).

---

## 🛠️ Persyaratan Teknis & Instalasi

Pastikan komputer Anda sudah terinstal **Node.js** (rekomendasi versi 18 atau ke atas) dan npm.

### Langkah-langkah Memulai:

1. **Klon atau Unduh Repositori Ini**:
   Letakkan semua berkas dalam struktur direktori Anda.

2. **Instal Dependensi**:
   Jalankan perintah berikut di terminal root proyek Anda untuk mengunduh semua library yang diperlukan (Vite, pdf-lib, pdfjs-dist, dll):
   ```bash
   npm install
   ```

3. **Jelajahi Lingkungan Pengembangan Lokal (Local Dev)**:
   Untuk menjalankan server pengembangan lokal dengan fitur autoreload, masukkan perintah berikut:
   ```bash
   npm run dev
   ```
   Setelah itu, buka peramban dan akses alamat lokal yang tertera di terminal Anda (biasanya `http://localhost:3000`).

---

## 📦 Kompilasi Berkas Produksi (Build)

Untuk mengompilasi dan membundel kode sumber yang ada di dalam map `web-src/` menjadi berkas produksi siap pakai di root proyek Anda, jalankan:
```bash
npm run build
```

Perintah ini akan secara otomatis:
1. Membersihkan berkas-berkas sisa dari kompilasi sebelumnya di root folder (kecuali berkas konfigurasi penting seperti `web-src/`, `.gitignore`, `package.json`, dll).
2. Menjalankan bundling Vite dan memformulasikan seluruh kode html/css/js siap deploy ke dalam struktur folder utama.

---

## 🖥️ Panduan Deploy ke GitHub Pages

Proyek ini telah dikonfigurasi khusus agar dapat disajikan langsung melalui **GitHub Pages** langsung dari akar instalasi (root folder):

1. **Buat Repositori Baru** di akun GitHub Anda (misal: `pdf-utility`).
2. **Kompilasi Berkas**: Pastikan Anda telah menjalankan perintah `npm run build` terlebih dahulu di lokal untuk menghasilkan aset terbaru.
3. **Commit dan Push**: Push semua berkas ini termasuk `index.html` dan direktori `assets/` hasil build yang ada di **root directory** ke repositori GitHub Anda.
   *(Pastikan `.gitignore` Anda tidak menyembunyikan folder `assets/` dan `index.html` di root karena berkas-berkas tersebutlah yang dibuka oleh server GitHub Pages).*
4. **Aktifkan GitHub Pages**:
   - Pergi ke tab **Settings** di halaman repositori GitHub Anda.
   - Pilih menu **Pages** di panel sebelah kiri.
   - Pada bagian *Build and deployment*, atur Source ke **Deploy from a branch**.
   - Pilih branch utama Anda (misal: `main` atau `master`) dan atur direktori folder target ke `/(root)`.
   - Tekan tombol **Save**.
5. **Aplikasi Siap Saji**: Dalam beberapa menit, aplikasi PDF Suite kustom Anda akan terbit secara langsung dan dapat diakses bebas oleh semua orang!
