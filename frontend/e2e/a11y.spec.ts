import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { adminLogin, firstProductSlug } from './helpers';

async function scan(page: Page) {
  // Let reveal animations settle so colour contrast is measured on final styles.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForLoadState('networkidle');
  // Scroll through once so every reveal-on-scroll fade has finished before contrast is measured.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const report = serious.map((v) => `${v.id}: ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n  ')}`).join('\n');
  expect(serious, report).toEqual([]);
}

const STOREFRONT = ['/', '/shop', '/offers', '/cart', '/checkout', '/login', '/register', '/track-order', '/search?q=lamp', '/this-does-not-exist'];

for (const path of STOREFRONT) {
  test(`storefront ${path} has no serious accessibility issues`, async ({ page }) => {
    await page.goto(path);
    await scan(page);
  });
}

test('a product page has no serious accessibility issues', async ({ page }) => {
  await page.goto(`/products/${await firstProductSlug(page)}`);
  await scan(page);
});

test('a category page has no serious accessibility issues', async ({ page }) => {
  const nav = (await (await page.request.get('/api/v1/categories/')).json()) as { slug: string }[];
  await page.goto(`/shop/${nav[0].slug}`);
  await scan(page);
});

const ADMIN_PAGES = ['', '/orders', '/products', '/products/new', '/inventory', '/content', '/offers/coupons', '/settings', '/activity'];

test('admin screens have no serious accessibility issues (light and dark)', async ({ page }) => {
  await adminLogin(page);
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    for (const path of ADMIN_PAGES) {
      await page.goto(`/admin-panel${path}`);
      await test.step(`${theme} ${path || '/'}`, () => scan(page));
    }
  }
});
