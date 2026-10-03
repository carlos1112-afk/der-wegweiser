import { test, describe, afterEach, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { AiGatewayService } from '../src/services/ai/aiGatewayService.ts';

describe('AiGatewayService Timeout Fallback', () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  test('8000ms timeout triggers offline fallback', async () => {
    AiGatewayService.configure('backend_proxy', 'http://fake', 8000);

    // Mock fetch to simulate a slow network call (hangs indefinitely)
    // When abort signal triggers, fetch should throw an error as it naturally does
    const fetchMock = mock.method(global, 'fetch', async (url, options) => {
      return new Promise((resolve, reject) => {
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('The user aborted a request.', 'AbortError'));
          });
        }
      });
    });

    // Start a dispatch call without awaiting it immediately, so we can advance time
    const dispatchPromise = AiGatewayService.dispatch({
      systemPrompt: 'sys',
      userPrompt: 'user'
    });

    // Advance timers by 8000ms to trigger the AbortController
    mock.timers.tick(8000);

    const response = await dispatchPromise;

    assert.strictEqual(response.provider, 'heuristic_offline');
    assert.strictEqual(response.text, 'Erfolgreich navigiert. Tourdaten lokal verifiziert.');
    assert.strictEqual(fetchMock.mock.callCount(), 1);
  });
});
