import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { spawn } from 'node:child_process';

const SCRIPT = path.resolve('scripts/anthropic_federation_exchange.sh');
const SECRET_JWT = 'eyJ.GEHEIMES-JWT.sig';
const SECRET_TOKEN = 'sk-ant-oat01-GEHEIMES-ZUGRIFFSTOKEN';

let server: http.Server;
let baseUrl: string;
let received: { body: Record<string, unknown> | null };
let reply: { status: number; json: unknown };
let dir: string;
let jwtFile: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { received.body = JSON.parse(data); } catch { received.body = null; }
      res.writeHead(reply.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(reply.json));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/oauth/token`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(() => {
  received = { body: null };
  reply = { status: 200, json: { access_token: SECRET_TOKEN, expires_in: 600 } };
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fed-'));
  jwtFile = path.join(dir, 'jwt');
  fs.writeFileSync(jwtFile, SECRET_JWT);
});

const baseEnv = () => ({
  PATH: process.env.PATH ?? '',
  ANTHROPIC_OAUTH_URL: baseUrl,
  ANTHROPIC_IDENTITY_TOKEN_FILE: jwtFile,
  ANTHROPIC_FEDERATION_RULE_ID: 'fdrl_test',
  ANTHROPIC_ORGANIZATION_ID: 'org-test',
  ANTHROPIC_SERVICE_ACCOUNT_ID: 'svac_test',
});

// asynchron, weil der Mock-Server im selben Prozess antworten muss
function run(env: Record<string, string>): Promise<{ status: number; out: string }> {
  return new Promise((resolve) => {
    const p = spawn('bash', [SCRIPT], { env });
    let out = '';
    p.stdout.on('data', (c) => (out += c));
    p.stderr.on('data', (c) => (out += c));
    p.on('close', (code) => resolve({ status: code ?? -1, out }));
  });
}

describe('anthropic_federation_exchange.sh', () => {
  it('Erfolg: Exit 0, sendet die dokumentierten Felder, gibt weder JWT noch Token aus', async () => {
    const r = await run(baseEnv());
    expect(r.status).toBe(0);
    expect(r.out).toContain('OK');
    expect(r.out).not.toContain(SECRET_TOKEN);
    expect(r.out).not.toContain(SECRET_JWT);
    expect(received.body).toEqual({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: SECRET_JWT,
      federation_rule_id: 'fdrl_test',
      organization_id: 'org-test',
      service_account_id: 'svac_test',
    });
  });

  it('sendet workspace_id nur, wenn gesetzt', async () => {
    await run({ ...baseEnv(), ANTHROPIC_WORKSPACE_ID: 'wrkspc_test' });
    expect(received.body?.workspace_id).toBe('wrkspc_test');
  });

  it('401 vom Server: Exit 1, Hinweis auf Authentication history, keine Geheimnisse in der Ausgabe', async () => {
    reply = { status: 401, json: { error: { message: 'Authentication failed' } } };
    const r = await run(baseEnv());
    expect(r.status).toBe(1);
    expect(r.out).toContain('HTTP 401');
    expect(r.out).toContain('Authentication history');
    expect(r.out).not.toContain(SECRET_JWT);
  });

  it('200 ohne gültiges Token (falsches Präfix): Exit 1, Token wird nicht ausgegeben', async () => {
    reply = { status: 200, json: { access_token: 'sk-ant-api03-KEIN-OAUTH-TOKEN' } };
    const r = await run(baseEnv());
    expect(r.status).toBe(1);
    expect(r.out).not.toContain('KEIN-OAUTH-TOKEN');
  });

  it('200 ohne access_token: Exit 1', async () => {
    reply = { status: 200, json: {} };
    expect((await run(baseEnv())).status).toBe(1);
  });

  it('Endpunkt nicht erreichbar: Exit 1', async () => {
    const r = await run({ ...baseEnv(), ANTHROPIC_OAUTH_URL: 'http://127.0.0.1:1/x' });
    expect(r.status).toBe(1);
    expect(r.out).toContain('nicht erreichbar');
  });

  it.each([
    'ANTHROPIC_FEDERATION_RULE_ID',
    'ANTHROPIC_ORGANIZATION_ID',
    'ANTHROPIC_SERVICE_ACCOUNT_ID',
    'ANTHROPIC_IDENTITY_TOKEN_FILE',
  ])('fehlende Variable %s: Exit 2, nennt nur den Namen, ruft den Server nicht auf', async (name) => {
    const env: Record<string, string> = { ...baseEnv() };
    delete env[name];
    const r = await run(env);
    expect(r.status).toBe(2);
    expect(r.out).toContain(name);
    expect(received.body).toBeNull();
  });

  it('leere Token-Datei: Exit 2, ruft den Server nicht auf', async () => {
    fs.writeFileSync(jwtFile, '');
    const r = await run(baseEnv());
    expect(r.status).toBe(2);
    expect(received.body).toBeNull();
  });

  it('Token-Datei existiert nicht: Exit 2', async () => {
    const r = await run({ ...baseEnv(), ANTHROPIC_IDENTITY_TOKEN_FILE: path.join(dir, 'gibt-es-nicht') });
    expect(r.status).toBe(2);
  });
});
