import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  // jsdom's AbortSignal isn't accepted by Node's Request/fetch (which MSW's interceptor uses). Queries
  // pass one for cancellation; tests don't need it at the network layer, so honour an already-aborted
  // signal and drop it otherwise. Installed after listen() so it wraps MSW's patched fetch.
  const interceptedFetch = globalThis.fetch;
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (!init?.signal) return interceptedFetch(input, init);
    if (init.signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    const { signal: _signal, ...rest } = init;
    return interceptedFetch(input, rest);
  };
});
afterEach(() => {
  server.resetHandlers();
  cleanup();
  localStorage.clear();
});
afterAll(() => server.close());

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class IO {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
Object.defineProperty(window, 'IntersectionObserver', { writable: true, value: IO });
Object.defineProperty(window, 'scrollTo', { writable: true, value: () => {} });

// jsdom replaces FormData with its own class, which Node's fetch can't serialise. Recover Node's
// native FormData (via a Response) so multipart requests behave as they do in a browser.
const nativeFormData = (
  await new Response('a=1', { headers: { 'content-type': 'application/x-www-form-urlencoded' } }).formData()
).constructor as typeof FormData;
Object.defineProperty(globalThis, 'FormData', { writable: true, value: nativeFormData });

