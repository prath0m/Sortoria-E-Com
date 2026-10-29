import { expect, test } from '@playwright/test';
import { adminLogin, firstProductSlug, watchErrors } from './helpers';

/** Phone-only behaviour (runs in the pixel-7 and iphone-13 projects). */

async function noSidewaysScroll(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${page.url()} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
}

test('the menu opens the department index and takes you to a department', async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Shop departments' });
  await expect(menu).toBeVisible();
  await noSidewaysScroll(page);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await page.getByRole('button', { name: 'Menu' }).click();
  await menu.getByRole('navigation', { name: 'Departments' }).getByRole('link').nth(1).tap();
  await expect(page).toHaveURL(/\/shop\/[\w-]+$/);
  await expect(menu).toBeHidden();
  noErrors();
});

test('filters open as a sheet and update the listing', async ({ page }) => {
  await page.goto('/shop');
  await page.getByRole('button', { name: /^Filter/ }).tap();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('checkbox').first().check();
  await expect(page).toHaveURL(/\?.+=/);
  await noSidewaysScroll(page);
});

test('a product can be bought from the sticky bar once the main button scrolls away', async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.goto(`/products/${await firstProductSlug(page)}`);
  for (const group of await page.getByRole('radiogroup').all()) {
    const options = group.getByRole('radio');
    for (let i = 0; i < (await options.count()); i += 1) {
      if (await options.nth(i).isEnabled()) {
        await options.nth(i).tap();
        break;
      }
    }
  }
  // Touch devices don't scroll on wheel events; scroll the page itself past the main button.
  await page.evaluate(() => window.scrollTo(0, 1600));
  const bar = page.locator('div.fixed.inset-x-0.bottom-0').filter({ has: page.getByRole('button', { name: 'Add to bag' }) });
  await expect(bar).toBeVisible();
  await bar.getByRole('button', { name: 'Add to bag' }).tap();
  await expect(page.getByText(/is in your bag/i).first()).toBeVisible();
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: /bag/i }).first()).toBeVisible();
  await noSidewaysScroll(page);
  noErrors();
});

test('search works with the on-screen keyboard flow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search' }).first().tap();
  await page.keyboard.type('lamp');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/search\?q=lamp/);
  await noSidewaysScroll(page);
});

test('the admin shows orders as cards and opens one', async ({ page }) => {
  const noErrors = watchErrors(page);
  await adminLogin(page);
  await page.goto('/admin/orders');
  const cards = page.getByRole('list', { name: 'Results' });
  await expect(cards).toBeVisible();
  await expect(page.locator('table')).toHaveCount(0);
  await noSidewaysScroll(page);
  await cards.locator('a[href^="/admin/orders/SRT-"]').first().tap();
  await expect(page).toHaveURL(/\/admin\/orders\/SRT-/);
  await noSidewaysScroll(page);
  noErrors();
});

test('old /admin-panel links still work', async ({ page }) => {
  await page.goto('/admin-panel/orders?status=placed');
  await expect(page).toHaveURL(/\/admin\/(login\?next=.*orders|orders\?status=placed)/);
});
