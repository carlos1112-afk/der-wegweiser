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

  test('8000ms timeout triggers offline fallback that throws (honest degradation)', async () => {
    AiGatewayService.configure('backend_proxy', 'http://fake', 8000);

    const fetchMock = mock.method(global, 'fetch', async (url, options) => {
      return new Promise((_, reject) => {
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('The user aborted a request.', 'AbortError'));
          });
        }
      });
    });

    const dispatchPromise = AiGatewayService.dispatch({
      systemPrompt: 'sys',
      userPrompt: 'user'
    });

    mock.timers.tick(8000);

    await assert.rejects(dispatchPromise, (err: Error) => {
      assert.strictEqual(fetchMock.mock.callCount(), 1);
      assert.ok(err.message.includes('Offline-Heuristik kann keine dynamischen Prompts verarbeiten'));
      return true;
    });
  });
});
