import React, { useState, useEffect } from 'react';
import ProductCard from './components/ProductCard';

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching flash products:', err);
        // Fallback demo product
        setProducts([
          {
            _id: 'flash_phone_500',
            name: 'FlashPhone Ultra 5G (Limited Edition)',
            description: 'Festival mega flash sale. Strictly limited to 500 numbered units with 16GB RAM and 512GB NVMe.',
            price: 699,
            stock: 500,
            totalInitialStock: 500,
            imageUrl: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=800&auto=format&fit=crop&q=80',
          },
        ]);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: '40px 20px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{
          display: 'inline-block',
          backgroundColor: 'rgba(251, 191, 36, 0.1)',
          color: 'var(--accent-gold)',
          border: '1px solid var(--accent-gold)',
          borderRadius: '20px',
          padding: '4px 14px',
          fontSize: '12px',
          fontWeight: 700,
          marginBottom: '12px',
        }}>
          ⚡ FESTIVE SALE DROP • HIGH CONCURRENCY ENGINE
        </div>
        <h1 style={{ fontSize: '32px', fontWeight: 900, marginBottom: '8px' }}>
          Exclusive 500-Batch Flash Sale
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', maxWidth: '600px', margin: '0 auto' }}>
          Backed by Redis atomic tokens, asynchronous queues, and MongoDB document-level atomic locks guaranteeing <strong>zero overselling</strong>.
        </p>
      </header>

      {/* Main Container */}
      <main>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <div className="spinner" style={{ width: '32px', height: '32px', borderColor: 'var(--accent-gold)', borderTopColor: 'transparent' }} />
            <p style={{ color: 'var(--text-muted)', marginTop: '16px' }}>Loading sale catalog...</p>
          </div>
        ) : (
          <div>
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </main>

      {/* Technical Metric Badges Footer */}
      <footer style={{ marginTop: '50px', textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span>🛡️ Client Throttling: <strong>Active (3s)</strong></span>
          <span>⚡ Atomic Decrements: <strong>Redis Lua / Mem</strong></span>
          <span>📨 Queue: <strong>BullMQ (202 Accepted)</strong></span>
          <span>🗄️ Persistence: <strong>MongoDB Atomic Inc</strong></span>
        </div>
      </footer>
    </div>
  );
}
