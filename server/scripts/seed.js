require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Product = require('../models/Product');
const { initializeInventory } = require('../services/redisInventory');

const seedData = async () => {
  await connectDB();

  console.log('[Seed] Seeding flash-sale product...');
  await Product.deleteMany({});

  const smartphone = await Product.create({
    name: 'FlashPhone Ultra 5G (Limited Edition)',
    description: 'High-demand festival edition flagship smartphone with 16GB RAM, 512GB Storage.',
    price: 699,
    stock: 500,
    totalInitialStock: 500,
    isActive: true,
    saleStartsAt: new Date(),
    imageUrl: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=800&auto=format&fit=crop&q=80',
  });

  console.log(`[Seed] Created product: ${smartphone.name} (ID: ${smartphone._id}) with 500 stock.`);

  // Attempt to sync Redis inventory token
  try {
    await initializeInventory(smartphone._id.toString(), 500);
    console.log(`[Seed] Initialized Redis inventory token for product ${smartphone._id} with 500.`);
  } catch (err) {
    console.warn(`[Seed] Redis sync skipped or failed (will sync on startup if Redis available): ${err.message}`);
  }

  console.log('[Seed] Seeding completed.');
  await mongoose.disconnect();
  process.exit(0);
};

if (require.main === module) {
  seedData().catch((err) => {
    console.error('[Seed] Error during seeding:', err);
    process.exit(1);
  });
}

module.exports = seedData;
