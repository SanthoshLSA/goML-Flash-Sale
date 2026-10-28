async function runTest() {
  const prodRes = await fetch('http://localhost:3000/api/products');
  const products = await prodRes.json();
  const target = products[0];

  const checkoutRes = await fetch('http://localhost:3000/api/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `test_${Date.now()}`,
    },
    body: JSON.stringify({
      productId: target.id,
      userId: 'user_test_01',
    }),
  });

  const checkoutData = await checkoutRes.json();

  if (checkoutRes.status !== 202) {
    throw new Error(`Expected 202, got ${checkoutRes.status}`);
  }

  await new Promise((r) => setTimeout(r, 200));

  const trackRes = await fetch(`http://localhost:3000/api/track/${checkoutData.trackingId}`);
  const trackData = await trackRes.json();

  console.log('Test result:', trackData);
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
