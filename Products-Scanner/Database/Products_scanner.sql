-- Hapus database jika sudah ada untuk menghindari error
DROP DATABASE IF EXISTS product_scanner;

-- Buat database baru
CREATE DATABASE product_scanner;

-- Gunakan database yang baru dibuat
USE product_scanner;

-- -----------------------------------------------------
-- Tabel utama produk
-- -----------------------------------------------------
CREATE TABLE products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    barcode VARCHAR(50) UNIQUE NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    brand VARCHAR(100),
    category VARCHAR(100),
    description TEXT,
    image_url VARCHAR(500),
    weight DECIMAL(10,2), -- dalam gram
    unit VARCHAR(20) DEFAULT 'gram',
    price DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_barcode (barcode),
    INDEX idx_product_name (product_name),
    INDEX idx_brand (brand),
    INDEX idx_category (category)
) ENGINE = InnoDB;


-- -----------------------------------------------------
-- Tabel informasi nutrisi
-- -----------------------------------------------------
CREATE TABLE nutrition_facts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    serving_size DECIMAL(10,2), -- dalam gram
    calories DECIMAL(10,2),
    
    -- Makronutrien
    total_fat DECIMAL(10,2),
    saturated_fat DECIMAL(10,2),
    trans_fat DECIMAL(10,2),
    cholesterol DECIMAL(10,2),
    sodium DECIMAL(10,2),
    total_carbs DECIMAL(10,2),
    dietary_fiber DECIMAL(10,2),
    total_sugars DECIMAL(10,2),
    added_sugars DECIMAL(10,2),
    protein DECIMAL(10,2),
    
    -- Vitamin dan mineral (opsional)
    vitamin_a DECIMAL(10,2),
    vitamin_c DECIMAL(10,2),
    calcium DECIMAL(10,2),
    iron DECIMAL(10,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE = InnoDB;


-- -----------------------------------------------------
-- Tabel gambar produk (untuk multiple images)
-- -----------------------------------------------------
CREATE TABLE product_images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    image_type ENUM('main', 'thumbnail', 'nutrition_label', 'packaging') DEFAULT 'main',
    alt_text VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE = InnoDB;


-- -----------------------------------------------------
-- Tabel kategori produk
-- -----------------------------------------------------
CREATE TABLE categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (parent_id) REFERENCES categories(id)
) ENGINE = InnoDB;


-- -----------------------------------------------------
-- Tabel brand/merek
-- -----------------------------------------------------
CREATE TABLE brands (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    logo_url VARCHAR(500),
    website VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

-- -----------------------------------------------------
-- Menyisipkan data sampel
-- -----------------------------------------------------

-- Data untuk tabel brands
INSERT INTO brands (name, website) VALUES 
('Nestle', 'https://nestle.com'),
('Unilever', 'https://unilever.com'),
('Danone', 'https://danone.com'),
('Indomie', NULL),
('Ultra Milk', NULL);

-- Data untuk tabel categories
INSERT INTO categories (name, description) VALUES 
('Makanan', 'Kategori makanan dan snack'),
('Minuman', 'Kategori minuman dan beverages'),
('Susu & Dairy', 'Produk susu dan olahannya'),
('Snack', 'Makanan ringan dan camilan');

-- Data untuk tabel products
INSERT INTO products (barcode, product_name, brand, category, description, weight, price) VALUES 
('8999999123456', 'Mie Instan Goreng Original', 'Indomie', 'Makanan', 'Mie instan goreng dengan rasa original yang lezat', 85.00, 2500.00),
('8999999654321', 'Susu UHT Full Cream', 'Ultra Milk', 'Susu & Dairy', 'Susu UHT full cream kaya nutrisi', 250.00, 5000.00);

-- Data untuk tabel nutrition_facts
INSERT INTO nutrition_facts (product_id, serving_size, calories, total_fat, total_carbs, protein, sodium) VALUES 
(1, 85.00, 390.00, 14.00, 58.00, 8.50, 1040.00),
(2, 250.00, 150.00, 8.00, 12.00, 8.00, 125.00);