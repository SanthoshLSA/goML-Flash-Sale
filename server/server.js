require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB, getProducts } = require('./db');
const { setStock } = require('./redis');
const { startWorker } = require('./queue');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(routes);

const start = async () => {
  await initDB();
  startWorker();

  try {
    const products = await getProducts();
    for (const p of products) {
      await setStock(p.id, parseInt(p.stock, 10));
    }
  } catch (e) {}

  return new Promise((resolve) => {
    const server = app.listen(PORT, () => {
      resolve(server);
    });
  });
};

if (require.main === module) {
  start().then(() => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = { app, start };
