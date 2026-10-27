// Mock import.meta.env prior to module imports
if (typeof (import.meta as any).env === 'undefined') {
  (import.meta as any).env = {};
}

import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage if missing in Node environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

import { dataRepository } from '../src/services/dataRepository';

test('TokenAccount fails closed and never accepts client-side balance changes', async () => {
  const userId = 'test-user-security-123';

  // Seed localStorage with legacy tokens entry to test purging
  localStorage.setItem(`tokens_${userId}`, JSON.stringify({ userId, balance: 99999, lifetimeEarned: 99999 }));
  assert.equal(localStorage.getItem(`tokens_${userId}`) !== null, true);

  // An absent server account has no credits, and legacy localStorage cannot create any.
  const account = await dataRepository.getTokenAccount(userId);
  assert.equal(account.userId, userId);
  assert.equal(account.balance, 0);
  assert.equal(account.unlimitedOnDemand, false);
  assert.equal(localStorage.getItem(`tokens_${userId}`), null, 'Legacy tokens entry in localStorage should be removed');

  // A client cannot award credits without server-verifiable earning evidence.
  await assert.rejects(dataRepository.addTokens(userId, 50, 'test_reward'), /server-verified earning event/);
  assert.equal(localStorage.getItem(`tokens_${userId}`), null, 'addTokens must not save to localStorage');

  // Spending is accepted only by trusted server callables.
  const deducted = await dataRepository.deductToken(userId, 10);
  assert.equal(deducted, false);
  assert.equal(localStorage.getItem(`tokens_${userId}`), null, 'deductToken must not save to localStorage');
});
