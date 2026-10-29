import { expect, test } from '@playwright/test';
import { firstProductSlug, watchErrors } from './helpers';

const WIDTHS = [360, 768, 1024, 1440];

test('no horizontal scrolling on key pages at every breakpoint', async ({ page }) => {
  const slug = await firstProductSlug(page);
  const paths = ['/', '/shop', `/products/${slug}`, '/offers', '/cart', '/checkout', '/login'];
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} at ${width}px overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  }
});

test('reduced motion turns off smooth scrolling and the headline reveal', async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Lenis adds this class to <html> only when smooth scrolling is running.
  await expect(page.locator('html')).not.toHaveClass(/lenis/);
  // The hero headline's word-by-word GSAP reveal is skipped entirely (GSAP sets inline transforms when it runs).
  await expect(page.locator('h1 [data-word]').first()).toBeVisible();
  const animated = await page.locator('h1 [data-word]').evaluateAll((words) => words.filter((w) => (w as HTMLElement).style.transform !== '').length);
  expect(animated).toBe(0);
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(400);
  noErrors();
});

test('pages work without smooth scrolling surprises on a phone', async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/');
  await page.getByRole('button', { name: /menu/i }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  noErrors();
});
