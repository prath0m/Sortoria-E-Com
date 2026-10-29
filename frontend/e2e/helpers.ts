import { expect, type Page } from '@playwright/test';

export const ADMIN = { email: 'admin@sartoria.test', password: 'Sartoria@Admin1' };

/** Fail the test on uncaught errors or console errors (network 4xx from deliberate checks aside). */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  return () => expect(errors, errors.join('\n')).toEqual([]);
}

export async function adminLogin(page: Page) {
  await page.goto('/admin-panel/login');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/admin-panel$/);
}

export async function firstProductSlug(page: Page, query = '') {
  const res = await page.request.get(`/api/v1/products/?page_size=40${query}`);
  const data = (await res.json()) as { results: { slug: string; in_stock: boolean; has_variants?: boolean }[] };
  return data.results.find((p) => p.in_stock)!.slug;
}
