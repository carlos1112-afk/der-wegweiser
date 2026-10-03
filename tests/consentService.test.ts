import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ConsentService, CONSENT_VERSION, type ConsentFlags } from '../src/services/consentService';

// In-Memory implementation of Web Storage API for Node.js test environment
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = new MemoryStorage();
}
if (typeof globalThis.sessionStorage === 'undefined') {
  (globalThis as any).sessionStorage = new MemoryStorage();
}

describe('ConsentService.save', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should save consent flags with timestamp and CONSENT_VERSION, and persist to localStorage', () => {
    const flags = {
      essential: true,
      analytics: true,
      surveys: false,
      personalizedAds: false,
    };

    const beforeTime = new Date().getTime();
    const saved = ConsentService.save(flags);
    const afterTime = new Date().getTime();

    // Assert returned structure
    assert.equal(saved.essential, true);
    assert.equal(saved.analytics, true);
    assert.equal(saved.surveys, false);
    assert.equal(saved.personalizedAds, false);
    assert.equal(saved.version, CONSENT_VERSION);

    // Verify valid ISO timestamp within execution window
    const acceptedAtTime = new Date(saved.acceptedAt).getTime();
    assert.ok(!isNaN(acceptedAtTime), 'acceptedAt should be a valid timestamp');
    assert.ok(acceptedAtTime >= beforeTime && acceptedAtTime <= afterTime, 'acceptedAt should be recent timestamp');

    // Assert persistence in localStorage
    const storedRaw = localStorage.getItem('der_wegweiser_legal_consent');
    assert.ok(storedRaw !== null, 'localStorage item should exist');

    const storedData = JSON.parse(storedRaw!);
    assert.deepEqual(storedData, saved);
  });

  it('should update ConsentService state and query getters after save', () => {
    // Before save
    assert.equal(ConsentService.getConsent(), null);
    assert.equal(ConsentService.hasValidConsent(), false);
    assert.equal(ConsentService.allowsEssential, false);
    assert.equal(ConsentService.allowsAnalytics, false);
    assert.equal(ConsentService.allowsSurveys, false);
    assert.equal(ConsentService.allowsPersonalizedAds, false);

    // Save flags
    ConsentService.save({
      essential: true,
      analytics: false,
      surveys: true,
      personalizedAds: true,
    });

    // After save
    assert.equal(ConsentService.hasValidConsent(), true);
    assert.equal(ConsentService.isGranted('essential'), true);
    assert.equal(ConsentService.isGranted('analytics'), false);
    assert.equal(ConsentService.isGranted('surveys'), true);
    assert.equal(ConsentService.isGranted('personalizedAds'), true);

    assert.equal(ConsentService.allowsEssential, true);
    assert.equal(ConsentService.allowsAnalytics, false);
    assert.equal(ConsentService.allowsSurveys, true);
    assert.equal(ConsentService.allowsPersonalizedAds, true);

    const consent = ConsentService.getConsent();
    assert.ok(consent !== null);
    assert.equal(consent?.version, CONSENT_VERSION);
    assert.equal(consent?.essential, true);
    assert.equal(consent?.analytics, false);
    assert.equal(consent?.surveys, true);
    assert.equal(consent?.personalizedAds, true);
  });

  it('should notify registered onChange listeners when save is called', () => {
    const receivedConsentLogs: ConsentFlags[] = [];
    const unsubscribe = ConsentService.onChange((flags) => {
      receivedConsentLogs.push(flags);
    });

    try {
      const flags1 = { essential: true, analytics: true, surveys: true, personalizedAds: false };
      const saved1 = ConsentService.save(flags1);

      assert.equal(receivedConsentLogs.length, 1);
      assert.deepEqual(receivedConsentLogs[0], saved1);
    } finally {
      unsubscribe();
    }
  });

  it('should notify multiple listeners and respect listener unsubscription', () => {
    const logs1: ConsentFlags[] = [];
    const logs2: ConsentFlags[] = [];

    const unsubscribe1 = ConsentService.onChange((flags) => logs1.push(flags));
    const unsubscribe2 = ConsentService.onChange((flags) => logs2.push(flags));

    try {
      const saved1 = ConsentService.save({
        essential: true,
        analytics: false,
        surveys: false,
        personalizedAds: false,
      });

      assert.equal(logs1.length, 1);
      assert.equal(logs2.length, 1);
      assert.deepEqual(logs1[0], saved1);
      assert.deepEqual(logs2[0], saved1);

      // Unsubscribe listener 1
      unsubscribe1();

      const saved2 = ConsentService.save({
        essential: true,
        analytics: true,
        surveys: true,
        personalizedAds: true,
      });

      // Listener 1 should not receive new event
      assert.equal(logs1.length, 1);

      // Listener 2 should receive new event
      assert.equal(logs2.length, 2);
      assert.deepEqual(logs2[1], saved2);
    } finally {
      unsubscribe2();
    }
  });

  it('should overwrite previously saved consent flags', () => {
    ConsentService.save({
      essential: true,
      analytics: false,
      surveys: false,
      personalizedAds: false,
    });

    assert.equal(ConsentService.allowsAnalytics, false);

    ConsentService.save({
      essential: true,
      analytics: true,
      surveys: false,
      personalizedAds: false,
    });

    assert.equal(ConsentService.allowsAnalytics, true);
    const updatedConsent = ConsentService.getConsent();
    assert.equal(updatedConsent?.analytics, true);
  });
});
