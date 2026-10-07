import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// background.js is a classic (non-module) service-worker script with no exports, so it is
// eval'd inside a function scope against a stubbed chrome API and the functions under
// test are returned from that scope.
const bgScript = fs.readFileSync(path.join(process.cwd(), 'background.js'), 'utf8');

const noopEvent = { addListener: () => {} };

function makeChromeStub() {
  return {
    runtime: { onMessage: noopEvent, onInstalled: noopEvent },
    contextMenus: { create: () => {}, removeAll: () => {}, onClicked: noopEvent },
    alarms: { onAlarm: noopEvent },
    bookmarks: {
      onCreated: noopEvent,
      onRemoved: noopEvent,
      onChanged: noopEvent,
      onMoved: noopEvent,
      onChildrenReordered: noopEvent
    }
  };
}

let bg;

beforeEach(() => {
  globalThis.chrome = makeChromeStub();
  bg = eval(`
    (() => {
      ${bgScript}
      return { fetchHtmlContent, checkSingleBookmark, extractTitleFromHtml, matchesDomainRule, normalizeUrlForComparison };
    })()
  `);
});

afterEach(() => {
  delete globalThis.chrome;
  mock.restoreAll();
});

/** Minimal Response-like object; `body` is omitted so readTextUpTo falls back to text(). */
function fakeResponse({ status = 200, url, contentType = 'text/html; charset=utf-8', text = '' } = {}) {
  return {
    ok: status < 400,
    status,
    statusText: String(status),
    url,
    headers: { get: name => (name.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => text
  };
}

describe('fetchHtmlContent', () => {
  it('should return null when response status is non-200 (e.g. 404)', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    }));

    const consoleErrorMock = mock.method(console, 'error', () => {});
    const consoleLogMock = mock.method(console, 'log', () => {});

    const result = await bg.fetchHtmlContent('http://example.com/not-found');

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

    const result = await bg.fetchHtmlContent('http://example.com/error');

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

    const result = await bg.fetchHtmlContent('http://example.com/success');

    assert.strictEqual(result, '<html>Test Content</html>');
    assert.strictEqual(consoleLogMock.mock.calls.length, 1);
    assert.strictEqual(consoleErrorMock.mock.calls.length, 0);
  });

  it('should truncate content to maxChars', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => 'abcdefghij'
    }));
    mock.method(console, 'log', () => {});

    const result = await bg.fetchHtmlContent('http://example.com/long', 4);

    assert.strictEqual(result, 'abcd');
  });

  it('should return null when fetch throws an exception', async () => {
    mock.method(globalThis, 'fetch', async () => {
      throw new Error('Network Error');
    });

    const consoleLogMock = mock.method(console, 'log', () => {});
    const consoleErrorMock = mock.method(console, 'error', () => {});

    const result = await bg.fetchHtmlContent('http://example.com/network-error');

    assert.strictEqual(result, null);
    assert.strictEqual(consoleLogMock.mock.calls.length, 1);
    assert.strictEqual(consoleErrorMock.mock.calls.length, 1);
    assert.strictEqual(consoleErrorMock.mock.calls[0].arguments[0], 'Error fetching HTML: request failed or timed out');
  });
});

describe('checkSingleBookmark', () => {
  const recent = Date.now() - 1000;
  const bookmark = { id: '1', url: 'https://example.com/page', title: 'Old Title', dateAdded: recent, dateLastUsed: recent };

  it('uses a single GET request and reports a changed title', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => fakeResponse({
      url: bookmark.url,
      text: '<html><head><title>New Title</title></head></html>'
    }));

    const result = await bg.checkSingleBookmark(bookmark, 365);

    assert.strictEqual(fetchMock.mock.calls.length, 1);
    assert.strictEqual(fetchMock.mock.calls[0].arguments[1].method, 'GET');
    assert.deepStrictEqual(result.issues, ['title_changed']);
    assert.strictEqual(result.newTitle, 'New Title');
    assert.strictEqual(result.status, 'title_changed');
    assert.strictEqual(result.statusCode, 200);
  });

  it('reports a dead link on a 4xx/5xx status', async () => {
    mock.method(globalThis, 'fetch', async () => fakeResponse({ status: 404, url: bookmark.url }));

    const result = await bg.checkSingleBookmark(bookmark, 365);

    assert.deepStrictEqual(result.issues, ['dead']);
    assert.strictEqual(result.status, 'dead');
    assert.strictEqual(result.statusCode, 404);
  });

  it('reports a redirect when the final URL differs', async () => {
    mock.method(globalThis, 'fetch', async () => fakeResponse({
      url: 'https://example.com/moved',
      text: '<title>Old Title</title>'
    }));

    const result = await bg.checkSingleBookmark(bookmark, 365);

    assert.deepStrictEqual(result.issues, ['redirect']);
    assert.strictEqual(result.newUrl, 'https://example.com/moved');
  });

  it('reports domain_gone when the request fails', async () => {
    mock.method(globalThis, 'fetch', async () => { throw new Error('ENOTFOUND'); });

    const result = await bg.checkSingleBookmark(bookmark, 365);

    assert.deepStrictEqual(result.issues, ['domain_gone']);
    assert.strictEqual(result.statusCode, 0);
  });

  it('flags stale bookmarks based on dateLastUsed', async () => {
    mock.method(globalThis, 'fetch', async () => fakeResponse({ url: bookmark.url, text: '<title>Old Title</title>' }));
    const old = { ...bookmark, dateLastUsed: Date.now() - 400 * 24 * 60 * 60 * 1000 };

    const result = await bg.checkSingleBookmark(old, 365);

    assert.deepStrictEqual(result.issues, ['stale']);
    assert.strictEqual(result.status, 'stale');
  });

  it('omits issues the user has disabled', async () => {
    mock.method(globalThis, 'fetch', async () => fakeResponse({
      status: 404,
      url: 'https://example.com/moved',
      text: '<title>New Title</title>'
    }));
    const old = { ...bookmark, dateLastUsed: Date.now() - 400 * 24 * 60 * 60 * 1000 };
    const types = { dead: false, domainGone: true, redirects: false, stale: false, titleChanged: false };

    const result = await bg.checkSingleBookmark(old, 365, types);

    assert.deepStrictEqual(result.issues, []);
    assert.strictEqual(result.status, 'ok');
    assert.strictEqual(result.statusCode, 404);
  });

  it('skips the network entirely when only the stale check is enabled', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => fakeResponse({ url: bookmark.url }));
    const types = { dead: false, domainGone: false, redirects: false, stale: true, titleChanged: false };

    const result = await bg.checkSingleBookmark(bookmark, 365, types);

    assert.strictEqual(fetchMock.mock.calls.length, 0);
    assert.deepStrictEqual(result.issues, []);
    assert.strictEqual(result.statusCode, null);
  });

  it('does not read the body when the title check is disabled', async () => {
    const text = mock.fn(async () => '<title>New Title</title>');
    mock.method(globalThis, 'fetch', async () => ({ ...fakeResponse({ url: bookmark.url }), text }));
    const types = { dead: true, domainGone: true, redirects: true, stale: true, titleChanged: false };

    const result = await bg.checkSingleBookmark(bookmark, 365, types);

    assert.strictEqual(text.mock.calls.length, 0);
    assert.deepStrictEqual(result.issues, []);
  });
});

describe('extractTitleFromHtml', () => {
  it('prefers og:title over <title>', () => {
    const html = '<head><meta property="og:title" content="OG Title"><title>Doc Title</title></head>';
    assert.strictEqual(bg.extractTitleFromHtml(html), 'OG Title');
  });

  it('handles attribute order content-before-property', () => {
    const html = '<meta content="OG Title" property="og:title">';
    assert.strictEqual(bg.extractTitleFromHtml(html), 'OG Title');
  });

  it('falls back to twitter:title then <title>', () => {
    assert.strictEqual(bg.extractTitleFromHtml('<meta name="twitter:title" content="TW"><title>T</title>'), 'TW');
    assert.strictEqual(bg.extractTitleFromHtml('<title> Doc Title </title>'), 'Doc Title');
  });

  it('returns null when no title is present', () => {
    assert.strictEqual(bg.extractTitleFromHtml('<p>nothing</p>'), null);
  });
});

describe('matchesDomainRule', () => {
  const rules = [
    { domain: 'github.com', folder: 'Dev/GitHub' },
    { domain: 'youtube.com/watch', folder: 'Media/Videos' }
  ];

  it('matches a bare hostname with or without www', () => {
    assert.strictEqual(bg.matchesDomainRule('https://github.com/foo/bar', rules), 'Dev/GitHub');
    assert.strictEqual(bg.matchesDomainRule('https://www.github.com/foo', rules), 'Dev/GitHub');
  });

  it('matches hostname plus path prefix', () => {
    assert.strictEqual(bg.matchesDomainRule('https://www.youtube.com/watch?v=1', rules), 'Media/Videos');
    assert.strictEqual(bg.matchesDomainRule('https://www.youtube.com/channel/x', rules), null);
  });

  it('returns null for no match, empty rules, or invalid URLs', () => {
    mock.method(console, 'warn', () => {});
    assert.strictEqual(bg.matchesDomainRule('https://example.com', rules), null);
    assert.strictEqual(bg.matchesDomainRule('https://github.com', []), null);
    assert.strictEqual(bg.matchesDomainRule('not a url', rules), null);
  });
});

describe('normalizeUrlForComparison', () => {
  it('ignores fragments and trailing slashes', () => {
    assert.strictEqual(
      bg.normalizeUrlForComparison('https://example.com/a/#top'),
      bg.normalizeUrlForComparison('https://example.com/a')
    );
  });

  it('returns the input unchanged when it is not a URL', () => {
    assert.strictEqual(bg.normalizeUrlForComparison('nope'), 'nope');
  });
});
