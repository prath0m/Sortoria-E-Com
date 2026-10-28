import type { RequestHandler } from 'msw';

/** Default handlers shared by every test; individual tests add their own with server.use(). */
export const handlers: RequestHandler[] = [];
