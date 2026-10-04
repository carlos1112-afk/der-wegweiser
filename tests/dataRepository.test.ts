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

test('TokenAccount caching should use in-memory cache and not LocalStorage', async () => {
  const userId = 'test-user-security-123';

  // Seed localStorage with legacy tokens entry to test purging
  localStorage.setItem(`tokens_${userId}`, JSON.stringify({ userId, balance: 99999, lifetimeEarned: 99999 }));
  assert.equal(localStorage.getItem(`tokens_${userId}`) !== null, true);

  // 1. Get token account - should purge legacy localStorage item and return token account
  const account = await dataRepository.getTokenAccount(userId);
  assert.equal(account.userId, userId);
  assert.equal(localStorage.getItem(`tokens_${userId}`), null, 'Legacy tokens entry in localStorage should be removed');

  // 2. Add tokens - should update in-memory cache and NOT populate localStorage
  const newBalance = await dataRepository.addTokens(userId, 50, 'test_reward');
  assert.equal(newBalance, account.balance + 50);
  assert.equal(localStorage.getItem(`tokens_${userId}`), null, 'addTokens must not save to localStorage');

  const cachedAccount = await dataRepository.getTokenAccount(userId);
  assert.equal(cachedAccount.balance, newBalance, 'Updated balance should be retained in memory');

  // 3. Deduct token - should update in-memory cache and NOT populate localStorage
  const deducted = await dataRepository.deductToken(userId, 10);
  assert.equal(deducted, true);
  assert.equal(localStorage.getItem(`tokens_${userId}`), null, 'deductToken must not save to localStorage');

  const finalAccount = await dataRepository.getTokenAccount(userId);
  assert.equal(finalAccount.balance, newBalance - 10, 'Deducted balance should be retained in memory');
});
