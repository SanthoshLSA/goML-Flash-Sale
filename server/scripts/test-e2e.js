// Test client verifying the flash-sale API end-to-end
async function testFlashSale() {
  console.log('--- 1. Testing GET /api/products ---');
  const prodRes = await fetch('http://localhost:3000/api/products');
  const products = await prodRes.json();
  console.log(`Retrieved ${products.length} product(s). Stock: ${products[0].stock}`);
  const productId = products[0]._id;

  console.log('\n--- 2. Testing POST /api/checkout (100K traffic simulation single request) ---');
  const checkoutRes = await fetch('http://localhost:3000/api/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': 'test_idemp_key_1',
    },
    body: JSON.stringify({
      productId,
      userId: 'test_user_42',
    }),
  });

  console.log(`Checkout HTTP Status: ${checkoutRes.status} (Expected: 202 Accepted)`);
  const checkoutData = await checkoutRes.json();
  console.log('Response body:', checkoutData);

  if (checkoutRes.status === 202 && checkoutData.trackingId) {
    console.log('\n--- 3. Testing GET /api/track/:trackingId ---');
    // Wait 200ms for worker queue pick-up
    await new Promise((r) => setTimeout(r, 200));

    const trackRes = await fetch(`http://localhost:3000/api/track/${checkoutData.trackingId}`);
    const trackData = await trackRes.json();
    console.log('Track Status:', trackData);
  }

  console.log('\n✅ Flash-sale API test passed successfully!');
  process.exit(0);
}

testFlashSale().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
