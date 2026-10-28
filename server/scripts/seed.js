require('dotenv').config();
const { initDB, pool, isPostgresConnected } = require('../config/db');
const ProductModel = require('../models/productModel');
const { initializeInventory } = require('../services/redisInventory');

const seedData = async () => {
  await initDB();

  console.log('[Seed] Seeding flash-sale product into PostgreSQL...');

  const phone = {
    id: 'flash_phone_500',
    name: 'FlashPhone Ultra 5G (Limited Edition)',
    description: 'High-demand festival edition flagship smartphone with 16GB RAM, 512GB Storage.',
    price: 699,
    stock: 500,
    total_initial_stock: 500,
    is_active: true,
    image_url: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=800&auto=format&fit=crop&q=80',
  };

  await ProductModel.upsert(phone);
  console.log(`[Seed] Seeded product: ${phone.name} (ID: ${phone.id}) with 500 stock.`);

  // Attempt to sync Redis inventory token
  try {
    await initializeInventory(phone.id, 500);
    console.log(`[Seed] Initialized Redis inventory token for product ${phone.id} with 500.`);
  } catch (err) {
    console.warn(`[Seed] Redis sync skipped or failed: ${err.message}`);
  }

  console.log('[Seed] Seeding completed.');
  if (pool && isPostgresConnected()) {
    await pool.end();
  }
  process.exit(0);
};

if (require.main === module) {
  seedData().catch((err) => {
    console.error('[Seed] Error during seeding:', err);
    process.exit(1);
  });
}

module.exports = seedData;
