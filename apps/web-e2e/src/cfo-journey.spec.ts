import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

// The CFO journey (howItWorks/SUMMARY.md §3, steps 1–6) as one test, run by the integrator in the main tree.
// It works on a copy of the seeded demo project (POST /api/projects/:id/duplicate); the demo is never modified.
// Numbers are compared before/after an edit rather than hardcoded, so a seed tweak does not break the journey.

const COPY_NAME = 'E2E CFO journey';

async function duplicateDemo(request: APIRequestContext): Promise<string> {
  const list = await request.get('/api/projects');
  expect(list.ok()).toBe(true);
  const demo = ((await list.json()) as Array<{ id: string; slug: string }>).find((p) => p.slug === 'taucha-stadtvilla');
  expect(demo, 'seeded demo project taucha-stadtvilla').toBeTruthy();
  const copy = await request.post(`/api/projects/${demo?.id}/duplicate`, { data: { name: COPY_NAME } });
  expect(copy.ok()).toBe(true);
  return ((await copy.json()) as { project: { id: string } }).project.id;
}

/** The header KPI strip value for a label (`<dt>label</dt><dd>value</dd>`, 02's KpiStrip). */
function kpi(page: Page, label: string): Locator {
  return page.getByText(label, { exact: true }).first().locator('xpath=following-sibling::dd[1]');
}

/** First euro amount in a text (`€659,940.15`, `€540,456` or `-€1,234`) → integer cents, parsed from the string, never via float.
 * KPI and hero cards show whole euros, so equal cents means equal at display precision. */
function eurToCents(text: string | null): number {
  const m = (text ?? '').match(/(-|−)?\s*€\s*(\d[\d,]*)(?:\.(\d{2}))?/);
  expect(m, `a euro amount in "${text}"`).toBeTruthy();
  const cents = Number(`${m?.[2].replace(/,/g, '')}${m?.[3] ?? '00'}`);
  return m?.[1] ? -cents : cents;
}

function itemPatchSaved(page: Page) {
  return page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes('/items/') && r.ok());
}

let projectId = '';

test.beforeEach(async ({ request }) => {
  projectId = await duplicateDemo(request);
});

test('should answer the CFO questions live across tabs and keep edits after a reload [AC-00.2]', async ({ page }) => {
  await test.step('1. Current projects lists the demo; open the working copy', async () => {
    await page.goto('/projects');
    await expect(page.getByText('Stadtvilla Taucha — Family of 4').first()).toBeVisible();
    await page.goto(`/projects/${projectId}/materials/electrical`);
    await expect(page.getByText(COPY_NAME).first()).toBeVisible();
  });

  await test.step('2. The KPI strip shows the five answers and the overrun count', async () => {
    for (const label of ['Budget', 'Spent', 'Open commitments', 'Forecast (EAC)', 'Variance']) {
      await expect(kpi(page, label)).toHaveText(/€/);
    }
    await expect(page.getByText(/\d+ lines? over budget/).first()).toBeVisible();
  });

  const forecastBefore = await kpi(page, 'Forecast (EAC)').textContent();

  await test.step('3. Editing the NYM-J cable quantity recalculates the row, section and KPIs, and survives a reload', async () => {
    // MAT-ELE-001 is PARTIAL in the seed (owner 12:06): 900 m makes planned < committed, so EAC drops to committed
    const cable = page.getByRole('table', { name: 'Electrical' }).locator('tr', { hasText: 'MAT-ELE-001' });
    const sectionTotal = page.getByTestId('section-planned');
    const totalBefore = await sectionTotal.textContent();

    await cable.getByRole('button', { name: 'Edit quantity MAT-ELE-001' }).click();
    const input = cable.getByRole('textbox', { name: 'quantity MAT-ELE-001' });
    await input.fill('900');
    const saved = itemPatchSaved(page);
    await input.press('Enter');

    // optimistic: visible before the save completes
    await expect(sectionTotal).not.toHaveText(totalBefore ?? '');
    await expect(kpi(page, 'Forecast (EAC)')).not.toHaveText(forecastBefore ?? '');
    await saved;

    await page.reload();
    await expect(
      page
        .getByRole('table', { name: 'Electrical' })
        .locator('tr', { hasText: 'MAT-ELE-001' })
        .getByRole('button', { name: 'Edit quantity MAT-ELE-001' }),
    ).toHaveText('900 m');
    await expect(kpi(page, 'Forecast (EAC)')).not.toHaveText(forecastBefore ?? '');
  });

  await test.step('4. Construction flags the late windows; moving the delivery earlier clears the alert', async () => {
    await page.goto(`/projects/${projectId}/construction/windows-install`);
    const alert = page.getByRole('alert', { name: 'Schedule conflicts' }).getByRole('listitem').filter({ hasText: 'MAT-WIN-001' });
    await expect(alert).toContainText('9 days');

    await alert.getByRole('link', { name: 'Open material' }).click();
    await expect(page).toHaveURL(/\/materials\/windows-doors\?highlight=/);
    const windows = page.getByRole('row').filter({ hasText: 'MAT-WIN-001' });
    await windows.getByRole('button', { name: 'Edit MAT-WIN-001 delivery date' }).click();
    const date = windows.getByRole('textbox').or(windows.locator('input[type="date"]'));
    await date.fill('2026-10-18');
    const saved = itemPatchSaved(page);
    await date.press('Enter');
    await saved;

    await page.getByRole('tab', { name: 'Construction' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'WRK-WIN-001' })).toContainText('Ready');
    await expect(page.getByText(/MAT-WIN-001\) arrive/)).toHaveCount(0);
  });

  await test.step('5. A supplier opens a modal with contacts', async () => {
    await page.goto(`/projects/${projectId}/materials/electrical`);
    const cable = page.getByRole('table', { name: 'Electrical' }).locator('tr', { hasText: 'MAT-ELE-001' });
    // the Supplier column (9th): its first button is the organisation name that opens OrganizationModal (as in 04's e2e)
    await cable.locator('td').nth(8).getByRole('button').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('a[href^="tel:"]')).toBeVisible();
    await expect(dialog.locator('a[href^="mailto:"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  await test.step('6. Profitability uses the same forecast; markup 15 % → 12 % lowers contract price and profit', async () => {
    await page.goto(`/projects/${projectId}/profitability`);
    const heroForecast = page.getByTestId('hero-forecast');
    await expect(heroForecast).toBeVisible();
    // one engine everywhere: the tab's EAC equals the header KPI after the step-3 edit
    expect(eurToCents(await heroForecast.innerText())).toBe(eurToCents(await kpi(page, 'Forecast (EAC)').innerText()));

    const markup = page.getByLabel('Company markup %');
    await expect(markup).toHaveValue('15.0');
    const price = page.getByTestId('hero-contract-price');
    const profit = page.getByTestId('hero-forecast-profit');
    const margin = page.getByTestId('hero-margin');
    const priceBefore = eurToCents(await price.innerText());
    const profitBefore = eurToCents(await profit.innerText());
    const marginBefore = await margin.innerText();

    const saved = page.waitForResponse(
      (r) => r.request().method() === 'PATCH' && r.url().endsWith(`/projects/${projectId}`) && r.ok(),
    );
    await markup.fill('12');
    await expect(margin).not.toHaveText(marginBefore);
    await expect.poll(async () => eurToCents(await price.innerText())).toBeLessThan(priceBefore);
    await expect.poll(async () => eurToCents(await profit.innerText())).toBeLessThan(profitBefore);
    await saved;
    const priceAfter = String(await price.textContent()); // textContent: what toHaveText compares (innerText is CSS-uppercased)

    await page.reload();
    await expect(page.getByLabel('Company markup %')).toHaveValue('12.0');
    await expect(page.getByTestId('hero-contract-price')).toHaveText(priceAfter);
  });
});
