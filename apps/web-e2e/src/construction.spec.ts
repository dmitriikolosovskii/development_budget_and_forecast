import { test, expect, type APIRequestContext } from '@playwright/test';

/** Works on a copy of the demo project (PROTOCOL §7): the seeded Taucha project is never modified. */
async function duplicateTaucha(request: APIRequestContext): Promise<string> {
  const list = await request.get('/api/projects');
  expect(list.ok()).toBe(true);
  const projects: Array<{ id: string; slug: string }> = await list.json();
  const taucha = projects.find((p) => p.slug === 'taucha-stadtvilla');
  expect(taucha, 'seeded demo project').toBeTruthy();
  const copy = await request.post(`/api/projects/${taucha?.id}/duplicate`, {
    data: { name: 'E2E construction' },
  });
  expect(copy.ok()).toBe(true);
  return (await copy.json()).project.id;
}

let projectId = '';

test.beforeEach(async ({ request }) => {
  projectId = await duplicateTaucha(request);
});

test('should clear the late-windows alert after the delivery moves earlier in Materials [AC-05.7]', async ({
  page,
}) => {
  await page.goto(`/projects/${projectId}/construction/windows-install`);

  const alerts = page.getByRole('alert', { name: 'Schedule conflicts' });
  const windowsAlert = alerts
    .getByRole('listitem')
    .filter({ hasText: 'MAT-WIN-001' });
  await expect(windowsAlert).toContainText('arrive 28 Oct, 9 days after');
  await expect(
    page.getByRole('row').filter({ hasText: 'WRK-WIN-001' }),
  ).toContainText('Blocked');

  await windowsAlert.getByRole('link', { name: 'Open material' }).click();
  await expect(page).toHaveURL(/\/materials\/windows-doors\?highlight=/);
  const materialRow = page.getByRole('row').filter({ hasText: 'MAT-WIN-001' });
  await materialRow.getByRole('button', { name: /^Edit .*date$/ }).click();
  const saved = page.waitForResponse(
    (r) => r.request().method() === 'PATCH' && r.url().includes('/items/'),
  );
  const input = materialRow
    .getByRole('textbox')
    .or(materialRow.locator('input[type="date"]'));
  await input.fill('2026-10-18');
  await input.press('Enter');
  expect((await saved).ok()).toBe(true);

  await page.getByRole('tab', { name: 'Construction' }).click();
  await expect(
    page.getByRole('row').filter({ hasText: 'WRK-WIN-001' }),
  ).toContainText('Ready');
  await expect(page.getByText(/MAT-WIN-001\) arrive/)).toHaveCount(0);
});

test('should save the shifted work start so it survives a reload [AC-05.7]', async ({
  page,
}) => {
  await page.goto(`/projects/${projectId}/construction/windows-install`);
  const row = page.getByRole('row').filter({ hasText: 'WRK-WIN-001' });
  await expect(row).toContainText('Blocked');

  const saved = page.waitForResponse(
    (r) => r.request().method() === 'PATCH' && r.url().includes('/items/'),
  );
  await page
    .getByRole('button', { name: 'Shift work start to 28 Oct' })
    .click();
  expect((await saved).ok()).toBe(true);
  await page.reload();

  await expect(row).toContainText('28 Oct 2026');
  await expect(row).toContainText('8 Nov 2026');
  await expect(row).toContainText('Ready');
});
