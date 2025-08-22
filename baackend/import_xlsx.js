const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const mysql = require('mysql2/promise');
require('dotenv').config();

// --- koneksi DB
async function getPool() {
  return mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'product_scanner',
    waitForConnections: true, connectionLimit: 5
  });
}

// util
const toNum = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
const cleanBarcode = (s) => String(s || '').replace(/\s+/g,'').replace(/[^\d]/g,'');
const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';
const toDriveDirect = (url) => {
  // support: https://drive.google.com/file/d/<ID>/view?... or .../open?id=<ID>
  const m1 = String(url||'').match(/\/d\/([^/]+)/);
  const m2 = String(url||'').match(/[?&]id=([^&]+)/);
  const id = (m1 && m1[1]) || (m2 && m2[1]);
  return id ? `https://drive.google.com/uc?export=view&id=${id}` : url;
};

// baca file
const filePath = process.argv[2];
if (!filePath || !fs.existsSync(filePath)) {
  console.error('Gunakan: node import_xlsx.js <data.xlsx|data.csv>');
  process.exit(1);
}

// load sheet
const wb = xlsx.readFile(filePath);
const sheetName = wb.SheetNames[0];
const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });

// header yang diharapkan (longgar)
function pick(obj, ...keys) {
  const map = {};
  for (const k of Object.keys(obj)) {
    const norm = k.toLowerCase().replace(/\s+/g,'').replace(/[()%]/g,'').replace(/\./g,'');
    map[norm] = k;
  }
  const get = (label) => obj[ map[label] ];
  const res = {};
  keys.forEach(k => res[k] = get(k));
  return res;
}

(async () => {
  const pool = await getPool();
  let ok = 0, skip = 0;

  for (const r of rows) {
    // ambil kolom berdasar nama yang dinormalisasi
    const col = pick(r,
      'namaproduk','produksi','ukuran/berat','satuan',
      'kaloritotalkkal','gulatotalgr',
      'karbohidrattot','akg','lemaktot','lemaktotakg','lemakjen','lemakjenakg',
      'protein','proteinakg','garammg','garamakg','kodebarcode','linkgambar','linkgambar1','linkgambar2'
    );

    const product_name = col['namaproduk'] ?? r['Nama Produk'];
    const producer     = col['produksi'] ?? r['Produksi'];
    const size_value   = toNum(col['ukuran/berat'] ?? r['Ukuran/Berat']);
    const size_unit    = col['satuan'] ?? r['Satuan'];
    const barcode      = cleanBarcode(col['kodebarcode'] ?? r['Kode Barcode']);

    if (!barcode || isEmpty(product_name)) { skip++; continue; }

    const calories_kcal = toNum(col['kaloritotalkkal'] ?? r['Kalori Total (kkal)']);
    const total_sugars_g = toNum(col['gulatotalgr'] ?? r['Gula Total (gr)']);

    // Pattern header “Nutrien | % AKG” dua kolom: kita cari manual
    const carbs_g   = toNum(r['Karbohidrat Tot'] ?? r['Karbohidrat'] ?? r['Karbohidrat (gr)']);
    const carbs_akg = toNum(r['% AKG'] ?? r['Karbohidrat % AKG'] ?? r['Karbohidrat Tot % AKG']);

    const fat_g     = toNum(r['Lemak Tot'] ?? r['Lemak (gr)']);
    const fat_akg   = toNum(r['Lemak Tot % AKG'] ?? r['Lemak % AKG']);

    const sat_g     = toNum(r['Lemak Jen'] ?? r['Lemak Jenuh (gr)']);
    const sat_akg   = toNum(r['Lemak Jen % AKG'] ?? r['Lemak Jenuh % AKG']);

    const protein_g   = toNum(r['Protein'] ?? r['Protein (gr)']);
    const protein_akg = toNum(r['Protein % AKG']);

    const sodium_mg   = toNum(r['Garam (mg)'] ?? r['Natrium (mg)']);
    const sodium_akg  = toNum(r['% AKG_1'] ?? r['Garam % AKG'] ?? r['Natrium % AKG']);

    const linkRaw = r['Link Gambar'] || r['Link gambar'] || r['Link'] || '';
    const image_url = toDriveDirect(linkRaw);

    // insert
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [ins] = await conn.execute(
        `INSERT INTO products (barcode, product_name, producer, size_value, size_unit)
         VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           product_name=VALUES(product_name), producer=VALUES(producer),
           size_value=VALUES(size_value), size_unit=VALUES(size_unit),
           updated_at=CURRENT_TIMESTAMP`,
        [barcode, product_name, producer, size_value, size_unit]
      );
      const product_id = ins.insertId || (await conn.execute(`SELECT id FROM products WHERE barcode=?`, [barcode])).then(([r])=>r[0].id);

      await conn.execute(
        `INSERT INTO nutrition_facts
          (product_id, calories_kcal, total_sugars_g, total_carbs_g, total_carbs_akg_percent,
           total_fat_g, total_fat_akg_percent, saturated_fat_g, saturated_fat_akg_percent,
           protein_g, protein_akg_percent, sodium_mg, sodium_akg_percent, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE
           calories_kcal=VALUES(calories_kcal),
           total_sugars_g=VALUES(total_sugars_g),
           total_carbs_g=VALUES(total_carbs_g),
           total_carbs_akg_percent=VALUES(total_carbs_akg_percent),
           total_fat_g=VALUES(total_fat_g),
           total_fat_akg_percent=VALUES(total_fat_akg_percent),
           saturated_fat_g=VALUES(saturated_fat_g),
           saturated_fat_akg_percent=VALUES(saturated_fat_akg_percent),
           protein_g=VALUES(protein_g),
           protein_akg_percent=VALUES(protein_akg_percent),
           sodium_mg=VALUES(sodium_mg),
           sodium_akg_percent=VALUES(sodium_akg_percent),
           updated_at=CURRENT_TIMESTAMP`,
        [product_id, calories_kcal, total_sugars_g, carbs_g, carbs_akg,
         fat_g, fat_akg, sat_g, sat_akg, protein_g, protein_akg, sodium_mg, sodium_akg]
      );

      if (image_url && !/^\s*$/.test(image_url)) {
        await conn.execute(
          `INSERT INTO product_images (product_id, image_url, image_type)
           VALUES (?, ?, 'main')
           ON DUPLICATE KEY UPDATE image_url=VALUES(image_url)`,
          [product_id, image_url]
        );
      }

      await conn.commit();
      ok++;
    } catch (e) {
      await conn.rollback();
      console.error('Row gagal:', product_name, e.message);
      skip++;
    } finally {
      conn.release();
    }
  }

  console.log(`Import selesai. OK: ${ok}, Skip: ${skip}`);
  process.exit(0);
})();
