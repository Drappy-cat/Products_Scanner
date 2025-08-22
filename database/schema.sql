CREATE DATABASE IF NOT EXISTS product_scanner
  CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE product_scanner;

-- Hapus jika sebelumnya ada (agar bersih)
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS nutrition_facts;
DROP TABLE IF EXISTS products;

-- Tabel produk (mengikuti header sheet)
CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barcode VARCHAR(64) NOT NULL UNIQUE,      -- Kode Barcode
  product_name VARCHAR(255) NOT NULL,       -- Nama Produk
  producer VARCHAR(255),                    -- Produksi
  size_value DECIMAL(10,2),                 -- Ukuran/Berat
  size_unit VARCHAR(32),                    -- Satuan
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (product_name),
  INDEX idx_producer (producer)
);

-- Nilai gizi (dengan %AKG)
CREATE TABLE nutrition_facts (
  product_id INT PRIMARY KEY,
  calories_kcal DECIMAL(10,2),                       -- Kalori Total (kkal)
  total_sugars_g DECIMAL(10,2),                      -- Gula Total (gr)
  total_carbs_g DECIMAL(10,2),                       -- Karbohidrat (gr)
  total_carbs_akg_percent DECIMAL(5,2),              -- Karbohidrat % AKG
  total_fat_g DECIMAL(10,2),                         -- Lemak (gr)
  total_fat_akg_percent DECIMAL(5,2),                -- Lemak % AKG
  saturated_fat_g DECIMAL(10,2),                     -- Lemak Jenuh (gr)
  saturated_fat_akg_percent DECIMAL(5,2),            -- Lemak Jenuh % AKG
  protein_g DECIMAL(10,2),                           -- Protein (gr)
  protein_akg_percent DECIMAL(5,2),                  -- Protein % AKG
  sodium_mg DECIMAL(10,2),                           -- Garam/Natrium (mg)
  sodium_akg_percent DECIMAL(5,2),                   -- Garam % AKG
  updated_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_nf_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Gambar (bisa link Google Drive langsung)
CREATE TABLE product_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  image_url VARCHAR(512) NOT NULL,                   -- Link Gambar
  image_type ENUM('main','gallery') DEFAULT 'main',
  alt_text VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_prod_type (product_id, image_type),
  CONSTRAINT fk_pi_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Contoh data minimal untuk tes cepat
INSERT INTO products (barcode, product_name, producer, size_value, size_unit)
VALUES ('0712345678911','Mie Instan Goreng','PT. CONTOH',85,'g');
SET @p1 := LAST_INSERT_ID();
INSERT INTO nutrition_facts (product_id, calories_kcal, total_sugars_g, total_carbs_g, total_fat_g, saturated_fat_g, protein_g, sodium_mg, updated_at)
VALUES (@p1, 400, 7, 56, 14, 6, 8, 900, CURRENT_TIMESTAMP);
