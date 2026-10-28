# ⚡ Flash-Sale E-Commerce Platform

A high-performance flash-sale system designed to handle **100,000+ concurrent users** competing for **500 limited items** — with **zero overselling**.

## Architecture

```
Users → CDN → NGINX/Rate Limiter → Express API → Redis (Atomic Gate)
                                                       ↓
                                              BullMQ Job Queue
                                                       ↓
                                             Worker → PostgreSQL
```

### Key Design Decisions

| Layer | Technology | Why |
|---|---|---|
| **Inventory Gate** | Redis Atomic DECR + Lua | Single-threaded = zero race conditions at 100K ops/s |
| **Job Queue** | BullMQ (Redis-backed) | Decouples HTTP response (`202 Accepted`) from DB write |
| **Database** | PostgreSQL | Strict ACID transaction + `UPDATE ... WHERE stock > 0` + `CHECK (stock >= 0)` |
| **API** | Express.js | Stateless, horizontally scalable |
| **Frontend** | React + Vite | Throttled UI (3s lockout), SSE stock updates, optimistic state |

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (local or cloud free tier like [Neon](https://neon.tech) / [Supabase](https://supabase.com))
- Redis (local or [Upstash free tier](https://upstash.com/))

### Setup

```bash
# Clone and install
git clone https://github.com/SanthoshLSA/goML-Flash-Sale.git
cd goML-Flash-Sale
cp .env.example .env     # Edit with your PostgreSQL/Redis connection strings
npm install

# Seed test data (500 phones into PostgreSQL)
npm run seed --workspace=server

# Start development
npm run dev               # Starts both server (3000) and client (5173)
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://postgres:postgres@localhost:5432/flashsale` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `PORT` | API server port | `3000` |

## API Endpoints

| Method | Endpoint | Description | Response |
|---|---|---|---|
| `GET` | `/api/products` | List active sale products | `200` + products array |
| `POST` | `/api/checkout` | Purchase a product | `202` Accepted + tracking URL |
| `GET` | `/api/track/:trackingId` | Poll order status | `200` + status object |
| `GET` | `/api/products/:id/stock/sse` | Live stock updates (SSE) | Event stream |

## How It Prevents Overselling

1. **Redis Lua Script** atomically decrements inventory token in RAM in < 1ms — impossible to oversell at this layer.
2. **BullMQ Worker** processes orders sequentially — no database row lock contention or timeouts.
3. **PostgreSQL Conditional SQL Transaction** acts as the absolute invariant:
   ```sql
   BEGIN;
   UPDATE products SET stock = stock - 1 WHERE id = :id AND stock > 0 RETURNING stock;
   INSERT INTO orders ...;
   COMMIT;
   ```
4. **PostgreSQL Schema Constraint**: `stock INT NOT NULL CHECK (stock >= 0)` guarantees at the engine level that stock can never drop below zero.

## License

MIT
