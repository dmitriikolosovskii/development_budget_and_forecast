import { expect, test, type Page } from '@playwright/test';

// Block 06 e2e (run by the integrator in the main tree). Works on a copy of the demo project.
let projectId = '';

async function duplicateDemo(page: Page): Promise<string> {
  const list = await page.request.get('/api/projects');
  expect(list.ok()).toBe(true);
  const demo = (
    (await list.json()) as Array<{ id: string; slug: string }>
  ).find((p) => p.slug === 'taucha-stadtvilla');
  expect(demo, 'seeded demo project taucha-stadtvilla').toBeTruthy();
  const copy = await page.request.post(`/api/projects/${demo?.id}/duplicate`, {
    data: { name: 'E2E profitability copy' },
  });
  expect(copy.ok()).toBe(true);
  return ((await copy.json()) as { project: { id: string } }).project.id;
}

test.beforeEach(async ({ page }) => {
  projectId = await duplicateDemo(page);
});

test('should recalculate contract price, profit and margin when the markup goes from 15 % to 12 % and keep it after reload [AC-06.7]', async ({
  page,
}) => {
  await page.goto(`/projects/${projectId}/profitability`);
  const markup = page.getByLabel('Company markup %');
  await expect(markup).toHaveValue('15.0');
  const price = page.getByTestId('hero-contract-price');
  const profit = page.getByTestId('hero-forecast-profit');
  const margin = page.getByTestId('hero-margin');
  const priceBefore = await price.innerText();
  const profitBefore = await profit.innerText();
  const marginBefore = await margin.innerText();

  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === 'PATCH' &&
      r.url().endsWith(`/projects/${projectId}`) &&
      r.ok(),
  );
  await markup.fill('12');

  await expect(price).not.toHaveText(priceBefore);
  await expect(profit).not.toHaveText(profitBefore);
  await expect(margin).not.toHaveText(marginBefore);
  await saved;
  const priceAfter = String(await price.textContent()); // textContent: what toHaveText compares (innerText is CSS-uppercased)

  await page.reload();
  await expect(page.getByLabel('Company markup %')).toHaveValue('12.0');
  await expect(page.getByTestId('hero-contract-price')).toHaveText(priceAfter);
});

test('should change the Profitability forecast after a quantity edit on Building materials [AC-06.7]', async ({
  page,
}) => {
  await page.goto(`/projects/${projectId}/profitability`);
  const forecast = page.getByTestId('hero-forecast');
  await expect(forecast).toBeVisible();
  const forecastBefore = await forecast.innerText();

  await page.goto(`/projects/${projectId}/materials/electrical`);
  const cable = page
    .getByRole('table', { name: 'Electrical' })
    .locator('tr', { hasText: 'MAT-ELE-008' }); // PLANNED: forecast = planned
  await cable
    .getByRole('button', { name: 'Edit quantity MAT-ELE-008' })
    .click();
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === 'PATCH' && r.url().includes('/items/') && r.ok(),
  );
  await cable.getByRole('textbox', { name: 'quantity MAT-ELE-008' }).fill('20');
  await page.keyboard.press('Enter');
  await saved;

  await page.getByRole('tab', { name: 'Profitability' }).click();
  await expect(page.getByTestId('hero-forecast')).toBeVisible();
  await expect(page.getByTestId('hero-forecast')).not.toHaveText(
    forecastBefore,
  );
});
