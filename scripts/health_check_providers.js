#!/usr/bin/env node
/**
 * Der Wegweiser — Automated Provider Health & Schema Verification
 * Validates active health, latency, and response schema of all external/backend providers.
 */

import http from 'node:http';
import { spawn } from 'node:child_process';

const PROXY_PORT = 13375;
const PROXY_URL = `http://127.0.0.1:${PROXY_PORT}`;

function httpRequest(url, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 5000,
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsedData = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsedData, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: null, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runHealthCheck() {
  console.log('🩺 ========================================================');
  console.log('🩺 AUTOMATED PROVIDER HEALTH & SCHEMA INTEGRITY CHECK');
  console.log('🩺 ========================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Start Proxy in Background
  const proxyProcess = spawn('python3', ['scripts/cloud/vertex_proxy.py'], {
    env: { ...process.env, PORT: String(PROXY_PORT) },
    stdio: 'ignore',
  });

  await new Promise((r) => setTimeout(r, 1200));

  try {
    // 2. Health Endpoint
    console.log('\n🩺 [1] System Health Endpoint Check');
    const health = await httpRequest(`${PROXY_URL}/api/v1/health`);
    assert(health.status === 200, `Health check returned HTTP 200 (Got: ${health.status})`);
    assert(health.data && health.data.status === 'healthy', 'Health response status is "healthy"');
    assert(health.data && health.data.services?.ai_gateway === 'operational', 'AI Gateway service flagged as operational');

    // 3. Remote Feature Flags / Kill-Switch
    console.log('\n🚩 [2] Remote Feature Flags & Kill-Switch Check');
    const config = await httpRequest(`${PROXY_URL}/api/v1/remote-config`);
    assert(config.status === 200, `Remote config returned HTTP 200 (Got: ${config.status})`);
    assert(config.data && config.data.aiEnabled === true, 'Default aiEnabled is active');
    assert(config.data && config.data.maintenanceMode === false, 'Default maintenanceMode is false');
    assert(config.data && config.data.minSupportedVersion === '1.0.0', 'minSupportedVersion is set to 1.0.0');

    // 4. Weather Provider
    console.log('\n🌦️ [3] Live Weather Provider (/api/v1/weather)');
    const weather = await httpRequest(`${PROXY_URL}/api/v1/weather?latitude=52.52&longitude=13.405`);
    assert(weather.status === 200, `Weather endpoint responded HTTP 200 (Got: ${weather.status})`);
    assert(
      weather.data && weather.data.current_weather && typeof weather.data.current_weather.temperature === 'number',
      `Weather response contains numerical temperature (${weather.data?.current_weather?.temperature}°C)`
    );

    // 5. Elevation Provider
    console.log('\n⛰️ [4] Live Elevation Provider (/api/v1/elevation)');
    const elevation = await httpRequest(`${PROXY_URL}/api/v1/elevation?latitude=52.52&longitude=13.405`);
    assert(elevation.status === 200, `Elevation endpoint responded HTTP 200 (Got: ${elevation.status})`);
    assert(
      elevation.data && Array.isArray(elevation.data.elevation) && elevation.data.elevation.length > 0,
      `Elevation response contains elevation array (${elevation.data?.elevation?.[0]}m)`
    );

    // 6. AI Gateway Provider
    console.log('\n🧠 [5] AI Gateway Dispatch (/api/v1/ai)');
    const aiReq = await httpRequest(
      `${PROXY_URL}/api/v1/ai`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        model: 'gemini-3.6-flash',
        messages: [{ role: 'user', content: 'Kurzer Reichweitencheck' }],
      }
    );
    assert(aiReq.status === 200, `AI Gateway responded HTTP 200 (Got: ${aiReq.status})`);
    assert(aiReq.data && aiReq.data.model === 'gemini-3.6-flash', `AI Gateway used confirmed model (${aiReq.data?.model})`);
    assert(
      aiReq.data && aiReq.data.choices && aiReq.data.choices[0]?.message?.content?.length > 0,
      'AI Gateway returned non-empty assistant response message'
    );

    // 7. Caching Validation
    console.log('\n⚡ [6] Backend In-Memory Caching Verification');
    const t0 = Date.now();
    await httpRequest(`${PROXY_URL}/api/v1/weather?latitude=52.52&longitude=13.405`);
    const cachedLatency = Date.now() - t0;
    assert(cachedLatency < 50, `Subsequent cached request served in ${cachedLatency}ms (< 50ms)`);

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    proxyProcess.kill('SIGTERM');
  }

  console.log('\n========================================================');
  console.log(`HEALTH CHECK SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runHealthCheck();
