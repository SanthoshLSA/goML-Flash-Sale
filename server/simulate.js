const { start } = require('./server');

async function ensureServer() {
  try {
    const res = await fetch('http://localhost:3000/health');
    if (res.ok) return null;
  } catch (e) {}

  return await start();
}

async function simulate() {
  await ensureServer();

  const initialStock = 5;
  const concurrentRequests = 10;

  console.log('====================================================');
  console.log(`Setting product stock to: ${initialStock}`);
  console.log(`Firing ${concurrentRequests} concurrent checkout requests at the exact same instant...`);
  console.log('====================================================');

  await fetch('http://localhost:3000/api/products/phone_flash_01/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stock: initialStock }),
  });

  const promises = [];
  for (let i = 1; i <= concurrentRequests; i++) {
    const req = fetch('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `sim_idemp_${i}_${Date.now()}`,
      },
      body: JSON.stringify({
        productId: 'phone_flash_01',
        userId: `user_${i}`,
      }),
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    });

    promises.push(req);
  }

  const results = await Promise.all(promises);

  let acceptedCount = 0;
  let soldOutCount = 0;
  let rateLimitedCount = 0;
  let otherCount = 0;

  for (const r of results) {
    if (r.status === 202) acceptedCount++;
    else if (r.status === 409 || r.data.status === 'SOLD_OUT') soldOutCount++;
    else if (r.status === 429) rateLimitedCount++;
    else otherCount++;
  }

  await new Promise((r) => setTimeout(r, 500));

  const finalCheck = await fetch('http://localhost:3000/api/products');
  const products = await finalCheck.json();
  const phone = products.find((p) => p.id === 'phone_flash_01');

  console.log('--- SIMULATION RESULTS ---');
  console.log(`Total Requests Sent:    ${concurrentRequests}`);
  console.log(`Initial Stock:          ${initialStock}`);
  console.log(`Accepted Orders (202):  ${acceptedCount}`);
  console.log(`Sold Out Rejected (409):${soldOutCount}`);
  if (rateLimitedCount > 0) {
    console.log(`Rate Limited (429):     ${rateLimitedCount}`);
  }
  console.log(`Final Remaining Stock:  ${phone ? phone.stock : 0}`);
  console.log('--------------------------');

  if (acceptedCount === initialStock && (phone ? phone.stock : 0) === 0) {
    console.log(`SUCCESS: Zero overselling. Exactly ${initialStock} units sold, ${soldOutCount} rejected.`);
  } else {
    console.log('Check results above.');
  }

  process.exit(0);
}

simulate().catch((err) => {
  console.error('Simulation error:', err);
  process.exit(1);
});
