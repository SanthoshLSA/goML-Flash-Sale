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
      .catch(() => {
        setProducts([
          {
            id: 'phone_flash_01',
            name: 'FlashPhone Ultra 5G',
            description: 'Festival flash sale flagship smartphone. 500 units available.',
            price: 699,
            stock: 500,
            total_initial_stock: 500,
            image_url: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=800&auto=format&fit=crop&q=80',
          },
        ]);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: '32px 16px', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '6px' }}>
          Festival Flash Sale
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Sale is live. Limited quantities available.
        </p>
      </header>

      <main>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="spinner" style={{ width: '28px', height: '28px', borderColor: 'var(--accent-gold)', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          products.map((p) => <ProductCard key={p.id} product={p} />)
        )}
      </main>
    </div>
  );
}
