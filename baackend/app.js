// app.js - Main server file (improved)
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middleware ----------
app.use(cors()); // kalau mau batasi origin, ganti jadi cors({ origin: ['http://localhost:5173'] })
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Pastikan folder uploads ada
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

// ---------- Database connection ----------
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'product_scanner',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};
const pool = mysql.createPool(dbConfig);

// ---------- File upload configuration ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed!'), false);
  }
});

// ---------- Database helper ----------
class DatabaseHelper {
  static async executeQuery(query, params = []) {
    try {
      const [rows] = await pool.execute(query, params);
      return rows;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  static baseProductSelect() {
    // Gunakan alias untuk hindari tabrakan nama kolom
    return `
      SELECT
        p.id AS product_id,
        p.barcode,
        p.product_name,
        p.brand,
        p.category,
        p.description,
        p.weight,
        p.unit,
        p.price,
        p.created_at AS product_created_at,
        p.updated_at AS product_updated_at,
        n.serving_size AS nf_serving_size,
        n.calories AS nf_calories,
        n.total_fat AS nf_total_fat,
        n.saturated_fat AS nf_saturated_fat,
        n.trans_fat AS nf_trans_fat,
        n.cholesterol AS nf_cholesterol,
        n.sodium AS nf_sodium,
        n.total_carbs AS nf_total_carbs,
        n.dietary_fiber AS nf_dietary_fiber,
        n.total_sugars AS nf_total_sugars,
        n.protein AS nf_protein,
        n.updated_at AS nf_updated_at,
        pi.image_url AS main_image
      FROM products p
      LEFT JOIN nutrition_facts n ON p.id = n.product_id
      LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.image_type = 'main'
    `;
  }

  static async getProductById(id) {
    const q = this.baseProductSelect() + ` WHERE p.id = ? LIMIT 1`;
    const rows = await this.executeQuery(q, [id]);
    return rows[0] || null;
  }

  static async getImagesByProductId(id) {
    return await this.executeQuery(
      `SELECT image_url, image_type, alt_text FROM product_images WHERE product_id = ? ORDER BY id ASC`,
      [id]
    );
  }

  static async getByBarcodeExact(barcode) {
    const q = this.baseProductSelect() + ` WHERE p.barcode = ? LIMIT 1`;
    const rows = await this.executeQuery(q, [barcode]);
    return rows[0] || null;
  }

  static async countProductsBySearchTerm(searchTerm) {
    const like = `%${searchTerm}%`;
    // Count cukup di tabel products (kriteria hanya field p.*)
    const q = `
      SELECT COUNT(*) AS total
      FROM products p
      WHERE p.product_name LIKE ?
         OR p.brand LIKE ?
         OR p.barcode = ?
         OR p.description LIKE ?
    `;
    const rows = await this.executeQuery(q, [like, like, searchTerm, like]);
    return rows[0]?.total || 0;
  }

  static async searchProducts(searchTerm, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    const like = `%${searchTerm}%`;
    const prefix = `${searchTerm}%`;

    const q = `
      ${this.baseProductSelect()}
      WHERE p.product_name LIKE ?
         OR p.brand LIKE ?
         OR p.barcode = ?
         OR p.description LIKE ?
      ORDER BY
        CASE
          WHEN p.barcode = ? THEN 1
          WHEN p.product_name LIKE ? THEN 2
          WHEN p.brand LIKE ? THEN 3
          ELSE 4
        END,
        p.product_name ASC
      LIMIT ? OFFSET ?
    `;
    const rows = await this.executeQuery(q, [
      like, like, searchTerm, like,
      searchTerm, prefix, prefix,
      pageSize, offset
    ]);
    return rows;
  }
}

// ---------- API Docs (simple) ----------
app.get('/api', (req, res) => {
  res.json({
    name: 'Product Scanner API',
    endpoints: {
      search: 'GET /api/products/search?q=Indomie&page=1&pageSize=20',
      getById: 'GET /api/products/:id',
      scanBarcode: 'GET /api/products/scan/:barcode',
      create: 'POST /api/products (multipart/form-data: image?, fields...)',
      update: 'PUT /api/products/:id (multipart/form-data: image?, fields...)',
      categories: 'GET /api/categories',
      brands: 'GET /api/brands',
      uploadsStatic: 'GET /uploads/<filename>'
    }
  });
});

// ---------- Routes ----------

// 1) Search products (with pagination)
app.get('/api/products/search', async (req, res) => {
  try {
    const searchTerm = (req.query.q || '').trim();
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || req.query.limit || '20', 10), 1), 100);

    if (!searchTerm || searchTerm.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search term must be at least 2 characters long'
      });
    }

    const [items, total] = await Promise.all([
      DatabaseHelper.searchProducts(searchTerm, page, pageSize),
      DatabaseHelper.countProductsBySearchTerm(searchTerm)
    ]);

    res.json({
      success: true,
      data: {
        products: items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        query: searchTerm
      }
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during search' });
  }
});

// 2) Get product by ID (plus images)
app.get('/api/products/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid product id' });
    }

    const product = await DatabaseHelper.getProductById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const images = await DatabaseHelper.getImagesByProductId(id);
    res.json({ success: true, data: { product: { ...product, images } } });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// 3) Scan barcode (EXACT match & valid digits length)
app.get('/api/products/scan/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;
    if (!/^\d{8,14}$/.test(barcode)) {
      return res.status(400).json({ success: false, message: 'Invalid barcode format (digits 8–14 required)' });
    }

    const product = await DatabaseHelper.getByBarcodeExact(barcode);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found for this barcode',
        suggestion: 'Try manual search or add this product to our database'
      });
    }

    res.json({ success: true, data: { product, scanned_barcode: barcode } });
  } catch (error) {
    console.error('Barcode scan error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during barcode scan' });
  }
});

// 4) Add new product (with optional image)
app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    const {
      barcode, product_name, brand, category, description, weight, unit, price,
      serving_size, calories, total_fat, saturated_fat, trans_fat, cholesterol,
      sodium, total_carbs, dietary_fiber, total_sugars, protein
    } = req.body;

    if (!barcode || !product_name || !brand) {
      return res.status(400).json({ success: false, message: 'Barcode, product name, and brand are required' });
    }

    const exists = await DatabaseHelper.executeQuery(`SELECT id FROM products WHERE barcode = ?`, [barcode]);
    if (exists.length > 0) {
      return res.status(409).json({ success: false, message: 'Product with this barcode already exists' });
    }

    const result = await DatabaseHelper.executeQuery(
      `INSERT INTO products (barcode, product_name, brand, category, description, weight, unit, price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [barcode, product_name, brand, category, description, weight, unit, price]
    );
    const productId = result.insertId;

    // Insert nutrition facts if at least some core fields are provided
    if (calories || total_fat || total_carbs || protein) {
      await DatabaseHelper.executeQuery(
        `INSERT INTO nutrition_facts
         (product_id, serving_size, calories, total_fat, saturated_fat, trans_fat,
          cholesterol, sodium, total_carbs, dietary_fiber, total_sugars, protein)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, serving_size, calories, total_fat, saturated_fat, trans_fat,
         cholesterol, sodium, total_carbs, dietary_fiber, total_sugars, protein]
      );
      // NOTE: butuh UNIQUE/PK di nutrition_facts.product_id untuk upsert di endpoint PUT
    }

    if (req.file) {
      const imageUrl = `/uploads/${req.file.filename}`;
      await DatabaseHelper.executeQuery(
        `INSERT INTO product_images (product_id, image_url, image_type) VALUES (?, ?, ?)`,
        [productId, imageUrl, 'main']
      );
      // NOTE: idealnya ada UNIQUE(product_id, image_type) untuk upsert di endpoint PUT
    }

    const newProduct = await DatabaseHelper.getProductById(productId);
    const images = await DatabaseHelper.getImagesByProductId(productId);

    res.status(201).json({
      success: true,
      message: 'Product added successfully',
      data: { product: { ...newProduct, images } }
    });
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({ success: false, message: 'Internal server error while adding product' });
  }
});

// 5) Update product (with optional new image)
app.put('/api/products/:id', upload.single('image'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid product id' });
    }

    const {
      product_name, brand, category, description, weight, unit, price,
      serving_size, calories, total_fat, saturated_fat, trans_fat, cholesterol,
      sodium, total_carbs, dietary_fiber, total_sugars, protein
    } = req.body;

    const current = await DatabaseHelper.getProductById(id);
    if (!current) return res.status(404).json({ success: false, message: 'Product not found' });

    await DatabaseHelper.executeQuery(
      `UPDATE products SET
        product_name = COALESCE(?, product_name),
        brand = COALESCE(?, brand),
        category = COALESCE(?, category),
        description = COALESCE(?, description),
        weight = COALESCE(?, weight),
        unit = COALESCE(?, unit),
        price = COALESCE(?, price),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [product_name, brand, category, description, weight, unit, price, id]
    );

    // Upsert nutrition facts (butuh UNIQUE/PK di nutrition_facts.product_id)
    if (calories || total_fat || total_carbs || protein || serving_size || saturated_fat || trans_fat ||
        cholesterol || sodium || dietary_fiber || total_sugars) {
      await DatabaseHelper.executeQuery(
        `INSERT INTO nutrition_facts
          (product_id, serving_size, calories, total_fat, saturated_fat, trans_fat,
           cholesterol, sodium, total_carbs, dietary_fiber, total_sugars, protein)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           serving_size = COALESCE(VALUES(serving_size), serving_size),
           calories = COALESCE(VALUES(calories), calories),
           total_fat = COALESCE(VALUES(total_fat), total_fat),
           saturated_fat = COALESCE(VALUES(saturated_fat), saturated_fat),
           trans_fat = COALESCE(VALUES(trans_fat), trans_fat),
           cholesterol = COALESCE(VALUES(cholesterol), cholesterol),
           sodium = COALESCE(VALUES(sodium), sodium),
           total_carbs = COALESCE(VALUES(total_carbs), total_carbs),
           dietary_fiber = COALESCE(VALUES(dietary_fiber), dietary_fiber),
           total_sugars = COALESCE(VALUES(total_sugars), total_sugars),
           protein = COALESCE(VALUES(protein), protein),
           updated_at = CURRENT_TIMESTAMP`,
        [id, serving_size, calories, total_fat, saturated_fat, trans_fat,
         cholesterol, sodium, total_carbs, dietary_fiber, total_sugars, protein]
      );
    }

    // New main image (requires UNIQUE(product_id, image_type) for clean upsert)
    if (req.file) {
      const imageUrl = `/uploads/${req.file.filename}`;
      await DatabaseHelper.executeQuery(
        `INSERT INTO product_images (product_id, image_url, image_type)
         VALUES (?, ?, 'main')
         ON DUPLICATE KEY UPDATE image_url = VALUES(image_url)`,
        [id, imageUrl]
      );
    }

    const updated = await DatabaseHelper.getProductById(id);
    const images = await DatabaseHelper.getImagesByProductId(id);

    res.json({ success: true, message: 'Product updated successfully', data: { product: { ...updated, images } } });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ success: false, message: 'Internal server error while updating product' });
  }
});

// 6) Get categories
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await DatabaseHelper.executeQuery(
      `SELECT id, name FROM categories ORDER BY name ASC`
    );
    res.json({ success: true, data: { categories } });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// 7) Get brands
app.get('/api/brands', async (req, res) => {
  try {
    const brands = await DatabaseHelper.executeQuery(
      `SELECT id, name FROM brands ORDER BY name ASC`
    );
    res.json({ success: true, data: { brands } });
  } catch (error) {
    console.error('Get brands error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ---------- Error handling ----------
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File too large. Maximum size is 5MB.' });
    }
  }
  if (error && error.message === 'Only image files are allowed!') {
    return res.status(400).json({ success: false, message: error.message });
  }
  console.error('Unhandled error:', error);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ---------- 404 ----------
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});

// ---------- Start server ----------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API docs: http://localhost:${PORT}/api`);
});

module.exports = app;
