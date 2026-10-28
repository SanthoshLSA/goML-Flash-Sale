# ⚡ Flash-Sale E-Commerce Platform

A high-performance flash-sale system designed to handle **100,000+ concurrent users** competing for **500 limited items** — with **zero overselling**.

## Architecture

```
Users → CDN → NGINX/Rate Limiter → Express API → Redis (Atomic Gate)
                                                       ↓
                                              BullMQ Job Queue
                                                       ↓
                                              Worker → MongoDB
```

### Key Design Decisions

| Layer | Technology | Why |
|-------|-----------|-----|
| **Inventory Gate** | Redis Atomic DECR + Lua | Single-threaded = zero race conditions at 100K ops/s |
| **Job Queue** | BullMQ (Redis-backed) | Decouples HTTP response from DB write |
| **Database** | MongoDB | Document-level atomic `findOneAndUpdate` with `$gt` guard |
| **API** | Express.js | Stateless, horizontally scalable |
| **Frontend** | React + Vite | Throttled UI, SSE stock updates, optimistic state |

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or [Atlas free tier](https://www.mongodb.com/cloud/atlas))
- Redis (local or [Upstash free tier](https://upstash.com/))

### Setup

```bash
# Clone and install
git clone <repo-url>
cd flash-sale
cp .env.example .env     # Edit with your MongoDB/Redis connection strings
npm install

# Seed test data (500 phones)
npm run seed --workspace=server

# Start development
npm run dev               # Starts both server (3000) and client (5173)
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/flashsale` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `PORT` | API server port | `3000` |

## API Endpoints

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| `GET` | `/api/products` | List active sale products | `200` + products array |
| `POST` | `/api/checkout` | Purchase a product | `202` Accepted + tracking URL |
| `GET` | `/api/track/:trackingId` | Poll order status | `200` + status object |
| `GET` | `/api/products/:id/stock/sse` | Live stock updates (SSE) | Event stream |

## How It Prevents Overselling

1. **Redis Lua Script** atomically decrements inventory — impossible to oversell at this layer
2. **BullMQ Worker** processes orders sequentially — no concurrent DB writes
3. **MongoDB Guard** uses `findOneAndUpdate({ stock: { $gt: 0 } })` as an absolute safety net

## License

MIT
