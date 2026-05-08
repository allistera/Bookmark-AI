import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// We need to mock the global fetch and the chrome API since we're running in Node
let fetchHtmlContent;

beforeEach(async () => {
  globalThis.chrome = {
    runtime: {
      onMessage: { addListener: () => {} },
      onInstalled: { addListener: () => {} }
    },
    contextMenus: {
      create: () => {},
      onClicked: { addListener: () => {} }
    },
    alarms: {
      onAlarm: { addListener: () => {} }
    }
  };

  // Import the background script functions into our test scope
  // We have to read and eval since it's not exported
  const fs = await import('fs');
  const path = await import('path');
  const bgScript = fs.readFileSync(path.join(process.cwd(), 'background.js'), 'utf8');

  // Use eval to get the function reference
  const moduleScope = eval(`
        (() => {
            ${bgScript}
            return { fetchHtmlContent };
        })()
    `);

  fetchHtmlContent = moduleScope.fetchHtmlContent;
});

afterEach(() => {
  delete globalThis.chrome;
  mock.restoreAll();
});

describe('fetchHtmlContent', () => {
  it('should return null when response status is non-200 (e.g. 404)', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    }));

    const consoleErrorMock = mock.method(console, 'error', () => {});
    const consoleLogMock = mock.method(console, 'log', () => {});

    const result = await fetchHtmlContent('http://example.com/not-found');

    assert.strictEqual(result, null);
    assert.strictEqual(consoleErrorMock.mock.calls.length, 1);
    assert.strictEqual(consoleErrorMock.mock.calls[0].arguments[0], 'Failed to fetch URL: 404 Not Found');
    assert.strictEqual(consoleLogMock.mock.calls.length, 1);
  });

  it('should return null when response status is 500', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    }));

    const consoleErrorMock = mock.method(console, 'error', () => {});
    mock.method(console, 'log', () => {});

    const result = await fetchHtmlContent('http://example.com/error');

    assert.strictEqual(result, null);
    assert.strictEqual(consoleErrorMock.mock.calls.length, 1);
    assert.strictEqual(consoleErrorMock.mock.calls[0].arguments[0], 'Failed to fetch URL: 500 Internal Server Error');
  });

  it('should return text content when response status is 200 OK', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '<html>Test Content</html>'
    }));

    const consoleLogMock = mock.method(console, 'log', () => {});
    const consoleErrorMock = mock.method(console, 'error', () => {});

    const result = await fetchHtmlContent('http://example.com/success');

    assert.strictEqual(result, '<html>Test Content</html>');
    assert.strictEqual(consoleLogMock.mock.calls.length, 1);
    assert.strictEqual(consoleErrorMock.mock.calls.length, 0);
  });

  it('should return null when fetch throws an exception', async () => {
    const networkError = new Error('Network Error');
    mock.method(globalThis, 'fetch', async () => {
      throw networkError;
    });

    const consoleLogMock = mock.method(console, 'log', () => {});
    const consoleErrorMock = mock.method(console, 'error', () => {});

    const result = await fetchHtmlContent('http://example.com/network-error');

    assert.strictEqual(result, null);
    assert.strictEqual(consoleLogMock.mock.calls.length, 1);
    assert.strictEqual(consoleErrorMock.mock.calls.length, 1);
    assert.strictEqual(consoleErrorMock.mock.calls[0].arguments[0], 'Error fetching HTML:');
    assert.strictEqual(consoleErrorMock.mock.calls[0].arguments[1], networkError);
  });
});
