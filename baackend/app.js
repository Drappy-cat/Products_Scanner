// app.js - Main server file
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Database connection
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

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Database helper functions
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

    static async getProductById(id) {
        const query = `
            SELECT p.*, n.*, pi.image_url as main_image
            FROM products p
            LEFT JOIN nutrition_facts n ON p.id = n.product_id
            LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.image_type = 'main'
            WHERE p.id = ?
        `;
        const result = await this.executeQuery(query, [id]);
        return result[0] || null;
    }

    static async searchProducts(searchTerm, limit = 20) {
        const query = `
            SELECT p.id, p.barcode, p.product_name, p.brand, p.category, 
                   p.description, p.weight, p.unit, p.price,
                   n.calories, n.total_fat, n.total_carbs, n.protein,
                   pi.image_url as main_image
            FROM products p
            LEFT JOIN nutrition_facts n ON p.id = n.product_id
            LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.image_type = 'main'
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
            LIMIT ?
        `;
        
        const searchPattern = `%${searchTerm}%`;
        const exactPattern = `${searchTerm}%`;
        
        return await this.executeQuery(query, [
            searchPattern, searchPattern, searchTerm, searchPattern,
            searchTerm, exactPattern, exactPattern, limit
        ]);
    }
}

// API Routes

// 1. Search products endpoint
app.get('/api/products/search', async (req, res) => {
    try {
        const { q: searchTerm, limit = 20 } = req.query;
        
        if (!searchTerm || searchTerm.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Search term must be at least 2 characters long'
            });
        }

        const products = await DatabaseHelper.searchProducts(searchTerm.trim(), parseInt(limit));
        
        res.json({
            success: true,
            data: {
                products: products,
                total: products.length,
                query: searchTerm
            }
        });
        
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during search'
        });
    }
});

// 2. Get product by ID
app.get('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const product = await DatabaseHelper.getProductById(id);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Get additional images
        const images = await DatabaseHelper.executeQuery(
            'SELECT image_url, image_type, alt_text FROM product_images WHERE product_id = ?',
            [id]
        );

        res.json({
            success: true,
            data: {
                product: {
                    ...product,
                    images: images
                }
            }
        });
        
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// 3. Scan barcode endpoint (same as search but optimized for barcode)
app.get('/api/products/scan/:barcode', async (req, res) => {
    try {
        const { barcode } = req.params;
        
        if (!barcode || barcode.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Invalid barcode format'
            });
        }

        const products = await DatabaseHelper.searchProducts(barcode, 1);
        
        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Product not found for this barcode',
                suggestion: 'Try manual search or add this product to our database'
            });
        }

        res.json({
            success: true,
            data: {
                product: products[0],
                scanned_barcode: barcode
            }
        });
        
    } catch (error) {
        console.error('Barcode scan error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during barcode scan'
        });
    }
});

// 4. Add new product (with image upload)
app.post('/api/products', upload.single('image'), async (req, res) => {
    try {
        const {
            barcode, product_name, brand, category, description, weight, unit, price,
            // Nutrition facts
            serving_size, calories, total_fat, saturated_fat, trans_fat, cholesterol,
            sodium, total_carbs, dietary_fiber, total_sugars, protein
        } = req.body;

        // Validate required fields
        if (!barcode || !product_name || !brand) {
            return res.status(400).json({
                success: false,
                message: 'Barcode, product name, and brand are required'
            });
        }

        // Check if barcode already exists
        const existingProduct = await DatabaseHelper.executeQuery(
            'SELECT id FROM products WHERE barcode = ?',
            [barcode]
        );

        if (existingProduct.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Product with this barcode already exists'
            });
        }

        // Insert product
        const productResult = await DatabaseHelper.executeQuery(
            `INSERT INTO products (barcode, product_name, brand, category, description, weight, unit, price) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [barcode, product_name, brand, category, description, weight, unit, price]
        );

        const productId = productResult.insertId;

        // Insert nutrition facts if provided
        if (calories || total_fat || total_carbs || protein) {
            await DatabaseHelper.executeQuery(
                `INSERT INTO nutrition_facts 
                (product_id, serving_size, calories, total_fat, saturated_fat, trans_fat, 
                 cholesterol, sodium, total_carbs, dietary_fiber, total_sugars, protein) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [productId, serving_size, calories, total_fat, saturated_fat, trans_fat,
                 cholesterol, sodium, total_carbs, dietary_fiber, total_sugars, protein]
            );
        }

        // Handle image upload
        if (req.file) {
            const imageUrl = `/uploads/${req.file.filename}`;
            await DatabaseHelper.executeQuery(
                'INSERT INTO product_images (product_id, image_url, image_type) VALUES (?, ?, ?)',
                [productId, imageUrl, 'main']
            );
        }

        // Get the complete product data
        const newProduct = await DatabaseHelper.getProductById(productId);

        res.status(201).json({
            success: true,
            message: 'Product added successfully',
            data: {
                product: newProduct
            }
        });

    } catch (error) {
        console.error('Add product error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while adding product'
        });
    }
});

// 5. Update product
app.put('/api/products/:id', upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            product_name, brand, category, description, weight, unit, price,
            // Nutrition facts
            serving_size, calories, total_fat, saturated_fat, trans_fat, cholesterol,
            sodium, total_carbs, dietary_fiber, total_sugars, protein
        } = req.body;

        // Check if product exists
        const existingProduct = await DatabaseHelper.getProductById(id);
        if (!existingProduct) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Update product
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

        // Update nutrition facts
        if (calories || total_fat || total_carbs || protein) {
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

        // Handle new image upload
        if (req.file) {
            const imageUrl = `/uploads/${req.file.filename}`;
            await DatabaseHelper.executeQuery(
                'INSERT INTO product_images (product_id, image_url, image_type) VALUES (?, ?, ?) ' +
                'ON DUPLICATE KEY UPDATE image_url = VALUES(image_url)',
                [id, imageUrl, 'main']
            );
        }

        // Get updated product
        const updatedProduct = await DatabaseHelper.getProductById(id);

        res.json({
            success: true,
            message: 'Product updated successfully',
            data: {
                product: updatedProduct
            }
        });

    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while updating product'
        });
    }
});

// 6. Get categories
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await DatabaseHelper.executeQuery(
            'SELECT * FROM categories ORDER BY name ASC'
        );
        
        res.json({
            success: true,
            data: {
                categories: categories
            }
        });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// 7. Get brands
app.get('/api/brands', async (req, res) => {
    try {
        const brands = await DatabaseHelper.executeQuery(
            'SELECT * FROM brands ORDER BY name ASC'
        );
        
        res.json({
            success: true,
            data: {
                brands: brands
            }
        });
    } catch (error) {
        console.error('Get brands error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 5MB.'
            });
        }
    }
    
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API documentation: http://localhost:${PORT}/api`);
});

module.exports = app;