require('dotenv').config();
const { initDB, upsertProduct, pool, isPostgresConnected } = require('./db');
const { setStock } = require('./redis');

const seed = async () => {
  await initDB();

  const phone = {
    id: 'phone_flash_01',
    name: 'FlashPhone Ultra 5G',
    description: 'Special festival flash sale smartphone. Strictly 500 units.',
    price: 699,
    stock: 500,
    total_initial_stock: 500,
    is_active: true,
    image_url: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=800&auto=format&fit=crop&q=80',
  };

  await upsertProduct(phone);
  await setStock(phone.id, 500);

  console.log('Seeded 500 units for product:', phone.id);

  if (pool && isPostgresConnected()) {
    await pool.end();
  }
  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
