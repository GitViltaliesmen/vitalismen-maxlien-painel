import 'dotenv/config';

const API_URL = process.env.SMOKE_API_URL || 'http://localhost:3001/api';

const run = async () => {
  const res = await fetch(`${API_URL}/orders/draft`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'SmokeTest/1.0',
      'x-forwarded-for': '203.0.113.10'
    },
    body: JSON.stringify({
      country: 'EC',
      phone: '+593991234567',
      name: 'Pedro Lima',
      tracking: {
        fbclid: 'TEST_FBCLID_123',
        fbc: 'fb.1.1700000000.TEST_FBCLID_123',
        fbp: 'fb.1.1700000000.1111111111',
        sourceUrl: 'https://example.com/checkout?fbclid=TEST_FBCLID_123'
      }
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[SMOKE] Draft create failed:', data);
    process.exit(1);
  }

  const draftId = data.draftId;
  console.log('[SMOKE] Draft created:', draftId);

  const debug = await fetch(`${API_URL}/orders/draft/${draftId}/tracking`, {
    headers: { 'user-agent': 'SmokeTest/1.0' }
  }).then((r) => r.json()).catch(() => null);

  if (!debug || !debug.tracking) {
    console.log('[SMOKE] Debug endpoint not available. Set DEBUG_TRACKING=1 on server and restart.');
    return;
  }

  console.log('[SMOKE] tracking.fbclid:', !!debug.tracking.fbclid);
  console.log('[SMOKE] tracking.fbc:', !!debug.tracking.fbc);
  console.log('[SMOKE] tracking.fbp:', !!debug.tracking.fbp);
  console.log('[SMOKE] tracking.ip:', debug.tracking.ip || null);
  console.log('[SMOKE] tracking.userAgentLength:', debug.tracking.userAgentLength ?? null);
  console.log('[SMOKE] OK');
};

run().catch((e) => {
  console.error('[SMOKE] ERROR', e);
  process.exit(1);
});
