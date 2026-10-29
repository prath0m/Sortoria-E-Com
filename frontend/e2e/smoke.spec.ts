import { expect, test } from '@playwright/test';
import { adminLogin, watchErrors } from './helpers';

test('a guest browses, adds to the bag and checks out with cash on delivery', async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.goto('/shop');
  const card = page.locator('a[href^="/products/"]').first();
  await card.click();
  await page.waitForURL(/\/products\//);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Pick the first in-stock option for every option group, then add to the bag.
  const add = page.locator('[data-add-to-bag]').first();
  for (const group of await page.getByRole('radiogroup').all()) {
    const options = group.getByRole('radio');
    const count = await options.count();
    for (let i = 0; i < count; i += 1) {
      if (await options.nth(i).isEnabled()) {
        await options.nth(i).click();
        break;
      }
    }
  }
  await add.click();
  await expect(page.getByText(/is in your bag/i).first()).toBeVisible();

  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: /bag/i }).first()).toBeVisible();
  await page.goto('/checkout');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(`e2e+${Date.now()}@example.com`);
  const phones = page.locator('input[autocomplete="tel-national"]');
  await phones.nth(0).fill('9811122233');
  await page.locator('input[autocomplete="name"]').fill('Kavya Rao');
  await phones.nth(1).fill('9811122233');
  await page.locator('input[autocomplete="address-line1"]').fill('41 Amrita Shergill Marg');
  await page.locator('input[autocomplete="postal-code"]').fill('110003');
  await page.locator('input[autocomplete="address-level2"]').fill('New Delhi');
  await page.locator('select[autocomplete="address-level1"]').selectOption('Delhi');
  await page.getByRole('button', { name: 'Use this address' }).click();
  await page.getByRole('button', { name: 'Continue to delivery' }).click();
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await page.getByText(/cash on delivery/i).first().click();
  await page.getByRole('button', { name: /place order/i }).click();

  await page.waitForURL(/\/order\//, { timeout: 20_000 });
  await expect(page.getByText(/thank you/i).first()).toBeVisible();
  noErrors();
});

test('staff sign in and move an order along', async ({ page }) => {
  const noErrors = watchErrors(page);
  await adminLogin(page);
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
  await page.goto('/admin/orders?status=placed');
  // Table rows on desktop, cards on phones: the order number link exists in both.
  await page.locator('a[href^="/admin/orders/SRT-"]').first().click();
  await page.waitForURL(/\/admin\/orders\/SRT-/);
  await page.getByRole('button', { name: 'Mark confirmed' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('button', { name: 'Mark packed' })).toBeVisible();
  noErrors();
});

test('customers are kept out of the admin', async ({ page }) => {
  await page.goto('/admin/orders');
  await page.waitForURL(/\/admin\/login\?next=/);
  const api = await page.request.get('/api/v1/admin/orders/');
  expect(api.status()).toBe(401);
});
