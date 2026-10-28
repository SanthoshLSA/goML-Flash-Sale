const { pool, isPostgresConnected } = require('../config/db');

// In-memory fallback if PostgreSQL is not connected locally
let mockProducts = [
  {
    id: 'flash_phone_500',
    name: 'FlashPhone Ultra 5G (Limited Edition)',
    description: 'Flagship high-demand festive smartphone. Batch of 500 units only.',
    price: 699,
    stock: 500,
    total_initial_stock: 500,
    is_active: true,
    image_url: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=800&auto=format&fit=crop&q=80',
  },
];

const ProductModel = {
  async findActive() {
    if (isPostgresConnected() && pool) {
      try {
        const res = await pool.query(
          'SELECT id, name, description, price, stock, total_initial_stock, is_active, image_url FROM products WHERE is_active = TRUE'
        );
        if (res.rows.length > 0) return res.rows;
      } catch (err) {
        console.warn(`[ProductModel] Query error: ${err.message}`);
      }
    }
    return mockProducts;
  },

  async findById(id) {
    if (isPostgresConnected() && pool) {
      try {
        const res = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
        return res.rows[0] || null;
      } catch (err) {
        // fallback
      }
    }
    return mockProducts.find((p) => p.id === id) || null;
  },

  async upsert(product) {
    if (isPostgresConnected() && pool) {
      try {
        await pool.query(
          `INSERT INTO products (id, name, description, price, stock, total_initial_stock, is_active, image_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             stock = EXCLUDED.stock,
             total_initial_stock = EXCLUDED.total_initial_stock`,
          [
            product.id,
            product.name,
            product.description || '',
            product.price,
            product.stock,
            product.total_initial_stock,
            product.is_active ?? true,
            product.image_url || '',
          ]
        );
        return;
      } catch (err) {
        console.warn(`[ProductModel] Upsert error: ${err.message}`);
      }
    }

    const idx = mockProducts.findIndex((p) => p.id === product.id);
    if (idx >= 0) mockProducts[idx] = product;
    else mockProducts.push(product);
  },

  async resetStock(id, count) {
    if (isPostgresConnected() && pool) {
      try {
        await pool.query('UPDATE products SET stock = $1, total_initial_stock = $1 WHERE id = $2', [count, id]);
        return;
      } catch (e) {
        //
      }
    }
    const p = mockProducts.find((item) => item.id === id);
    if (p) p.stock = count;
  },
};

module.exports = ProductModel;
