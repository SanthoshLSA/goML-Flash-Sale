const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    trackingId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    status: {
      type: String,
      enum: ['QUEUED', 'CONFIRMED', 'FAILED', 'SOLD_OUT'],
      default: 'QUEUED',
      index: true,
    },
    idempotencyKey: {
      type: String,
      index: true,
    },
    confirmedAt: {
      type: Date,
    },
    failureReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate orders for same user + idempotencyKey or user + product in single sale
orderSchema.index({ userId: 1, productId: 1, status: 1 });

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

module.exports = Order;
