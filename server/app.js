const express = require('express');
const cors = require('cors');
const { generalLimiter } = require('./middleware/rateLimiter');

const checkoutRoutes = require('./routes/checkout');
const trackRoutes = require('./routes/track');
const productRoutes = require('./routes/products');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(generalLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'flash-sale-backend',
  });
});

// API Routes
app.use('/api/checkout', checkoutRoutes);
app.use('/api/track', trackRoutes);
app.use('/api/products', productRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[App Error]', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
