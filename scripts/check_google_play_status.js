import https from 'https';
import { execSync } from 'child_process';

console.log('🤖 ========================================================');
console.log('🤖 GOOGLE PLAY DEVELOPER API STATUS QUERY');
console.log('🤖 ========================================================');

const packageName = 'app.derwegweiser.navi';

try {
  const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
  console.log('Got gcloud auth token.');

  // Create Edit
  const postData = JSON.stringify({});
  const req = https.request(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/edits`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(`HTTP Status: ${res.statusCode}`);
      console.log(`Response: ${data}`);
    });
  });

  req.on('error', (err) => {
    console.error('Request error:', err);
  });

  req.write(postData);
  req.end();
} catch (e) {
  console.error('Error running check:', e.message);
}
