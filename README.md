# Flash Sale System

A high-concurrency flash sale e-commerce application built to handle massive traffic spikes with zero overselling.

## Tech Stack

- **Backend**: Node.js, Express
- **Frontend**: React, Vite
- **Database**: PostgreSQL
- **Cache & Concurrency**: Redis (single-threaded atomic operations)
- **Queue**: BullMQ

## How It Works

1. **Frontend Throttle**: The checkout button locks immediately on click (3-second cooldown) and sends a unique idempotency key to prevent double submissions.
2. **Rate Limiting**: Express rate limiter restricts rapid requests per IP.
3. **Redis Atomic Decrement**: The checkout route checks and decrements stock in Redis using a Lua script in memory. If stock is 0, the request is rejected immediately without touching PostgreSQL.
4. **Asynchronous Queue**: Orders that pass the Redis check are pushed to a BullMQ queue, and the API immediately returns `202 Accepted` with a tracking URL.
5. **Database Worker**: Background workers read orders from the queue sequentially and execute a strict PostgreSQL transaction:
   ```sql
   BEGIN;
   UPDATE products SET stock = stock - 1 WHERE id = $1 AND stock > 0 RETURNING stock;
   INSERT INTO orders (tracking_id, user_id, product_id, status, idempotency_key, confirmed_at) VALUES (...);
   COMMIT;
   ```
6. **Live Inventory (SSE)**: The frontend connects to a Server-Sent Events stream (`/api/products/:id/stock/sse`) for real-time stock updates.
7. **Order Polling**: The client polls `/api/track/:trackingId` every 1.5 seconds until the order is confirmed.

## Setup & Running

### Prerequisites

- Node.js 18+
- PostgreSQL (local or cloud like Neon / Supabase)
- Redis (local or Upstash)

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set your connection strings:
```env
DATABASE_URL=postgres://postgres:password@localhost:5432/flashsale
REDIS_URL=redis://localhost:6379
PORT=3000
```

*(Note: If PostgreSQL or Redis are not running, the application will use built-in in-memory fallbacks so you can test locally without external services).*

### 3. Seed Initial Inventory (500 units)

```bash
npm run seed --workspace=server
```

### 4. Start the Application

To run both backend (port 3000) and frontend (port 5173) together:

```bash
npm run dev
```

Or run them individually:

```bash
# Terminal 1 - Backend
npm run dev:server

# Terminal 2 - Frontend
npm run dev:client
```

Open `http://localhost:5173` in your browser.

### 5. Automated Test

To verify the complete checkout and tracking flow:

```bash
npm run test --workspace=server
```
