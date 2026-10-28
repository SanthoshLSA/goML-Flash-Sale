const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/flashsale';
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.warn(`[MongoDB] Connection warning/error: ${error.message}`);
    console.warn(`[MongoDB] Ensure MongoDB is running locally or set MONGO_URI in your .env file.`);
    return null;
  }
};

module.exports = connectDB;
