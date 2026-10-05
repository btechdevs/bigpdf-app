# PDFNest — Browser-only PDF Toolkit

Aplikasi web **HTML + Tailwind CSS + JavaScript** untuk mengelola PDF, terinspirasi dari
[bigpdf.11zon.com](https://bigpdf.11zon.com/). Bedanya: **semua proses berjalan di browser
pengguna** — tidak ada server, tidak ada unggahan file, tidak ada batas jumlah file.

```
bigpdf-app/
├── index.html            # shell aplikasi (CSS statis + Font Awesome + 4 script)
├── css/
│   ├── tailwind.css      # sumber Tailwind + komponen kustom (@layer)
│   └── app.css           # HASIL KOMPILASI
├── js/
│   ├── config.js         # katalog 27 tool (kategori, opsi, FAQ, cara pakai)
│   ├── core.js           # util: baca file, render pdf.js, ZIP, toast, dialog
│   ├── tools.js          # engine: 22 operasi pemrosesan PDF
│   └── app.js            # router + UI (render form dari config.js)
├── vendor/               # semua library (offline-ready)
│   ├── pdf-lib.min.js      # @cantoo/pdf-lib — buat/edit/enkripsi PDF
│   ├── pdf.min.js + pdf.worker.min.js  # pdf.js — render, teks, gambar
│   ├── jszip.min.js        # JSZip — arsip ZIP
│   └── fontawesome/        # ikon lokal (css + webfonts)
├── test/harness.html     # 43 test end-to-end untuk seluruh engine
├── test/layout.html      # 16 test tata letak
├── tailwind.config.js    # konfigurasi class
├── check-css.py          # deteksi class yang hilang dari CSS hasil kompilasi
├── check-dynamic.py      # verifikasi class
└── package.json          # devDependency Tailwind CLI
```

## Cara menjalankan

**Paling cepat:** klik dua kali `index.html`. Aplikasi berjalan langsung dari `file://`
(tanpa internet sekalipun, karena semua library dan CSS ada di folder lokal).

Dengan server lokal (disarankan saat pengembangan):

```bash
cd bigpdf-app
python -m http.server 8777      # lalu buka http://127.0.0.1:8777/
# atau: npx serve .
```

## Penting: CSS harus dikompilasi ulang setelah mengubah tampilan

`index.html` **tidak** memakai Tailwind Play CDN (runtime), karena kalau skrip itu gagal
dimuat seluruh halaman tampil tanpa gaya sama sekali (layout runtuh). Sebagai gantinya
dipakai CSS statis `css/app.css` yang sudah dikompilasi — hasilnya pasti tampil.

Setiap kali menambah/mengubah class Tailwind di `index.html` atau `js/*.js`, jalankan:

```bash
npm install              # sekali saja
npm run build:css        # kompilasi ulang css/app.css
npm run watch:css        # atau: pantau perubahan otomatis
```

Lalu verifikasi tidak ada class yang tertinggal:

```bash
python check-css.py      # class statis
python check-dynamic.py  # class yang dirakit dinamis (gradient kategori, ikon)
```

> Tailwind memindai file sebagai teks, jadi class yang dirakit dengan template literal
> (mis. `` `bg-${color}-500` ``) tidak akan terdeteksi. Kalau butuh class dinamis,
> pastikan nilainya ditulis utuh di sumber (seperti `color: 'from-indigo-500 to-blue-500'`
> di `config.js`) agar ikut terpindai.

## Tool yang tersedia (27)

| Kategori | Tool |
|---|---|
| **Organize PDF** | Merge PDF · Merge PDF & Images · Split PDF · Organize PDF · Remove Pages · Extract Pages |
| **Optimize PDF** | Compress PDF (2 mode + target ukuran) · Resize PDF · N-up / Multiple per Sheet |
| **Edit PDF** | Rotate PDF · Crop PDF · Add Page Numbers · Add Watermark · PDF Metadata · Flatten PDF |
| **Convert to PDF** | Image to PDF · JPG to PDF · PNG to PDF · WebP to PDF · TXT to PDF |
| **Convert from PDF** | PDF to Image · PDF to JPG · PDF to PNG · PDF to Text · Extract Images |
| **PDF Security** | Protect PDF (AES-256) · Unlock PDF |

## Fitur kunci

- **Privasi total** — file dibaca dengan File API, diproses di memori, ditulis lewat unduhan.
  Tidak ada request jaringan saat memproses.
- **Tampilan tidak bisa "gagal render"** — CSS dikompilasi ke file statis, bukan CDN runtime.
- **Drag & drop di mana-mana** — urutkan file sebelum merge, urutkan/putar/hapus halaman
  sebelum menyimpan (thumbnail di-render pdf.js dan di-cache).
- **Pemilihan halaman cerdas** — klik, Ctrl/Cmd-klik, Shift-klik untuk rentang; kosong = semua halaman.
- **Opsi dinamis** — setiap tool merender form-nya sendiri dari `config.js`
  (termasuk logika `showIf` berantai, mis. slider kualitas hanya muncul di mode Strong).
- **Kompresi dua mode** — *Light* (repack, teks tetap vektor) dan *Strong*
  (raster + JPEG quality/DPI/grayscale, bisa mengejar target ukuran file).
- **Keamanan** — Protect memakai AES-256 (revisi 6) dengan izin cetak/salin/ubah;
  Unlock membutuhkan password asli (tidak ada cracking).
- **Unduhan fleksibel** — hasil otomatis terunduh, atau satu ZIP untuk banyak file.
- **Bisa offline** — seluruh aplikasi, library, CSS, dan ikon tersimpan lokal.

## Menambah tool baru

1. Tambahkan entri di `js/config.js` (id, nama, kategori, ikon, `accept`, opsi, howTo, faq).
2. Tambahkan fungsinya di `js/tools.js` sebagai `OPS['<id>']`.
3. Tool otomatis muncul di beranda, daftar tool, kategori, pencarian, dan footer.

Untuk varian yang hanya berbeda default (mis. JPG→PDF memakai mesin Image→PDF),
pakai `baseTool: 'image-to-pdf'` + `defaults: { … }` — tanpa menulis ulang logika.

## Menjalankan test

Dua suite, keduanya jalan di browser tanpa dependensi:

| Suite | URL | Isi |
|---|---|---|
| **Engine** | `test/harness.html` | 43 test: membuat PDF/gambar uji, menjalankan setiap operasi, memeriksa hasil dengan pdf-lib + pdf.js (enkripsi, password salah, halaman kosong, ZIP). |
| **Layout** | `test/layout.html` | 16 test: memuat aplikasi di iframe, lalu mendeteksi **tumpang tindih elemen** dan **kartu yang menyempit** di setiap halaman × 5 posisi scroll. |

Status terakhir: **engine 43/43** · **layout 16/16**.

> `test/layout.html` ada karena pernah terjadi bug di mana `$('.grid', block)`
> mengambil `<span>` ikon (yang juga ber-class `grid place-items-center`) alih-alih
> container grid-nya, sehingga semua kartu tool ter-nest di dalam ikon 40px,
> menyempit jadi ~76px, dan menimpa heading kategori. Test ini menangkap kelas bug itu.

### Aturan penamaan selector (penting)

Jangan pakai selector class Tailwind generik (`.grid`, `.flex`, `.space-y-3`) untuk
mengambil elemen — class Tailwind sering muncul di banyak tempat (termasuk span ikon
`grid place-items-center`). Pakai **ID** atau **class penanda khusus**:

```js
// BURUK — bisa mengambil span ikon, bukan container
const grid = $('.grid', block);

// BAIK — ID unik
const grid = $('#catGrid', wrap);

// BAIK — class penanda khusus (dipakai di app.js)
const grid = $('.cat-tool-grid', block);
```

## Catatan teknis

- `@cantoo/pdf-lib` dipakai (bukan `pdf-lib` biasa) karena mendukung
  **`PDFDocument.encrypt()` dengan AES-256** dan enkripsi/dekripsi round-trip.
- Font standar PDF hanya menjangkau WinAnsi; teks di luar itu dinormalisasi
  (`sanitizeWinAnsi`) agar tidak ada glyph yang hilang.
- "Crop" memakai **CropBox** (standar PDF) sehingga konten asli tidak dihapus.
- "Compress → Light" tidak pernah memperbesar file: bila hasil lebih besar,
  file asli dikembalikan.
- Font Awesome dipasang lokal (`vendor/fontawesome/`) supaya ikon tetap tampil offline.

## Lisensi

Kode aplikasi bebas dipakai dan dimodifikasi. Library di `vendor/` mengikuti lisensinya
masing-masing (pdf-lib: MIT, pdf.js: Apache-2.0, JSZip: MIT/GPLv3, Tailwind: MIT,
Font Awesome Free: CC BY 4.0 / SIL OFL 1.1 / MIT).
