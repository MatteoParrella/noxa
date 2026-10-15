import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Home', () => {
  test('si apre dall’export statico con la lingua italiana', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');
    await expect(page.getByRole('heading', { level: 1, name: 'Noxa' })).toBeVisible();
  });

  test('non ha violazioni di accessibilità WCAG 2.2 AA', async ({ page }) => {
    await page.goto('/');
    const risultato = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(risultato.violations).toEqual([]);
  });
});
