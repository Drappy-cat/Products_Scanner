-- Database
CREATE DATABASE IF NOT EXISTS product_scanner
  CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE product_scanner;

-- Lookup opsional
CREATE TABLE IF NOT EXISTS brands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Produk
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barcode VARCHAR(20) NOT NULL UNIQUE,
  product_name VARCHAR(200) NOT NULL,
  brand VARCHAR(120),
  category VARCHAR(120),
  description TEXT,
  weight DECIMAL(10,2),         -- gram/ml
  unit VARCHAR(20),             -- 'g', 'ml', dll
  price DECIMAL(12,2),
  producer VARCHAR(200),        -- opsional
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 1:1 Nutrition Facts
CREATE TABLE IF NOT EXISTS nutrition_facts (
  product_id INT PRIMARY KEY,
  serving_size DECIMAL(10,2),
  calories DECIMAL(10,2),
  total_fat DECIMAL(10,2),
  saturated_fat DECIMAL(10,2),
  trans_fat DECIMAL(10,2),
  cholesterol DECIMAL(10,2),
  sodium DECIMAL(10,2),
  total_carbs DECIMAL(10,2),
  dietary_fiber DECIMAL(10,2),
  total_sugars DECIMAL(10,2),
  protein DECIMAL(10,2),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
               ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_nf_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE CASCADE
);

-- Gambar
CREATE TABLE IF NOT EXISTS product_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  image_url VARCHAR(512) NOT NULL,
  image_type ENUM('main','gallery') DEFAULT 'gallery',
  alt_text VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_main (product_id, image_type),
  CONSTRAINT fk_img_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE CASCADE
);
