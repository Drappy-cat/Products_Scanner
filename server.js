// Mengimpor modul yang dibutuhkan
const express = require('express');
const path = require('path');

// Membuat instance aplikasi express
const app = express();
const PORT = 3000; // Anda bisa menggunakan port lain jika 3000 sudah terpakai

// Middleware untuk menyajikan file statis (HTML, CSS, JS) dari folder 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Menjalankan server
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});