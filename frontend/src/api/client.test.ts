import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { api, peekInlined, setAccessToken } from './client';

afterEach(() => {
  delete window.__SARTORIA_DATA__;
  setAccessToken(null);
});

describe('server-inlined first-load data', () => {
  it('answers the matching GET once, then falls back to the network', async () => {
    let calls = 0;
    server.use(
      http.get('/api/v1/products/', () => {
        calls += 1;
        return HttpResponse.json({ from: 'network' });
      }),
    );
    window.__SARTORIA_DATA__ = { '/products/?category=lamps&page=1': { from: 'inline' } };
    expect(peekInlined('/products/?category=lamps&page=1')).toEqual({ from: 'inline' });
    expect(await api('/products/', { query: { category: 'lamps', page: 1 } })).toEqual({ from: 'inline' });
    expect(calls).toBe(0);
    expect(await api('/products/', { query: { category: 'lamps', page: 1 } })).toEqual({ from: 'network' });
    expect(calls).toBe(1);
  });

  it('is ignored when signed in, since inlined data is anonymous', async () => {
    server.use(http.get('/api/v1/products/x/', () => HttpResponse.json({ from: 'network' })));
    window.__SARTORIA_DATA__ = { '/products/x/': { from: 'inline' } };
    setAccessToken('token');
    expect(await api('/products/x/')).toEqual({ from: 'network' });
  });
});
