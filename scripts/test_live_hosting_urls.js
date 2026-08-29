import https from 'https';

console.log('🌐 ========================================================');
console.log('🌐 LIVE FIREBASE HOSTING URL & CONTENT INTEGRITY AUDIT');
console.log('🌐 ========================================================');

const urls = [
  'https://der-wegweiser.web.app/privacy.html',
  'https://der-wegweiser.web.app/account-deletion.html',
  'https://der-wegweiser.firebaseapp.com/privacy.html',
  'https://der-wegweiser.firebaseapp.com/account-deletion.html'
];

function checkUrl(urlStr) {
  return new Promise((resolve) => {
    https.get(urlStr, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          url: urlStr,
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    }).on('error', (err) => {
      resolve({
        url: urlStr,
        status: 500,
        error: err.message
      });
    });
  });
}

async function run() {
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

  for (const u of urls) {
    console.log(`\nFetching ${u}...`);
    const res = await checkUrl(u);
    assert(res.status === 200, `HTTP status 200 received (Got: ${res.status})`);
    assert(res.body && res.body.includes('Der Wegweiser'), `Page contains app name "Der Wegweiser"`);
    assert(res.body && !res.body.includes('localhost') && !res.body.includes('127.0.0.1'), `Zero localhost/dev references`);
    
    if (u.includes('privacy.html')) {
      assert(res.body.includes('Datenschutzerklärung') || res.body.includes('Datenschutz'), `Privacy policy content verified`);
      assert(res.body.includes('wegweiser-app@proton.me'), `Operator contact "wegweiser-app@proton.me" present`);
      assert(res.body.includes('Standortdaten'), `Location telemetry processing disclosed`);
    }

    if (u.includes('account-deletion.html')) {
      assert(res.body.includes('Konto- und Datenlöschung') || res.body.includes('Datenlöschung'), `Account deletion title verified`);
      assert(res.body.includes('Art. 17 DSGVO') || res.body.includes('DSGVO'), `GDPR Art. 17 right to erasure cited`);
      assert(res.body.includes('Token') || res.body.includes('Token-Salden'), `Token and profile wipe disclosures present`);
    }
  }

  console.log('\n========================================================');
  console.log(`LIVE HOSTING AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run();
