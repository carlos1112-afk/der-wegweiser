import https from 'https';

console.log('🧪 ========================================================');
console.log('🧪 LIVE FIRESTORE RULES REGRESSION TEST');
console.log('🧪 ========================================================');

const PROJECT_ID = 'der-wegweiser';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve) => {
    const url = new URL(`${BASE_URL}${path}`);
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      method,
      headers,
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          // ignore
        }
        resolve({ status: res.statusCode, data: parsed, raw: data });
      });
    });

    req.on('error', (err) => {
      resolve({ status: 500, error: err.message });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // 1. Test public read on charging_stations
  console.log('\n[1] Public Read on /charging_stations...');
  const res1 = await makeRequest('GET', '/charging_stations');
  assert(res1.status === 200 || res1.status === 404, `Public read charging_stations allowed (HTTP ${res1.status})`);

  // 2. Test unauthenticated write to /users/some_user (MUST BE REJECTED 403)
  console.log('\n[2] Unauthenticated Write to /users/unauthorized_user...');
  const res2 = await makeRequest('PATCH', '/users/unauthorized_user', {
    fields: { email: { stringValue: 'hack@evil.com' } }
  });
  assert(res2.status === 403 || res2.status === 401 || res2.status === 400, `Unauthenticated write to /users/ rejected (HTTP ${res2.status})`);

  // 3. Test content_reports inbound creation (MUST BE ALLOWED)
  console.log('\n[3] Inbound Create to /content_reports (Apple Guideline 1.2)...');
  const testReportId = `test-report-${Date.now()}`;
  const res3 = await makeRequest('PATCH', `/content_reports/${testReportId}`, {
    fields: {
      contentType: { stringValue: 'station' },
      contentId: { stringValue: 'test-123' },
      reason: { stringValue: 'Automated test report' },
      status: { stringValue: 'pending' },
      createdAt: { stringValue: new Date().toISOString() }
    }
  });
  assert(res3.status === 200, `Inbound create to /content_reports allowed (HTTP ${res3.status})`);

  // 4. Test public read on /content_reports (MUST BE FORBIDDEN 403)
  console.log('\n[4] Public Read on /content_reports (MUST BE FORBIDDEN)...');
  const res4 = await makeRequest('GET', `/content_reports/${testReportId}`);
  assert(res4.status === 403 || res4.status === 401, `Public read /content_reports forbidden (HTTP ${res4.status})`);

  // 5. Test public read on fallback collections (e.g. /system_secrets - MUST BE READ-ONLY / NO WRITE)
  console.log('\n[5] Write to unknown collection /admin_system_secrets (MUST BE FORBIDDEN)...');
  const res5 = await makeRequest('PATCH', '/admin_system_secrets/test_secret', {
    fields: { secretKey: { stringValue: '12345' } }
  });
  assert(res5.status === 403 || res5.status === 401 || res5.status === 400, `Write to unknown collection rejected (HTTP ${res5.status})`);

  console.log('\n========================================================');
  console.log(`LIVE FIRESTORE REGRESSION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
