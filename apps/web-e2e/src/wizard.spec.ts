import { expect, test } from '@playwright/test';

/**
 * Block 12: the wizard creates a new project from `template-efh-144` (it never touches the demo project).
 * Each run creates its own uniquely named project.
 */
test('should create a project with the wizard, list it and open its materials with rows [AC-12.6]', async ({
  page,
  request,
}) => {
  const name = `E2E Wizard ${Date.now()}`;
  await page.goto('/projects/new');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Calculate project' }),
  ).toBeVisible();

  await page.getByLabel('Project name', { exact: true }).fill(name);
  await page.getByLabel('Client', { exact: true }).fill('Familie E2E');
  await page.getByLabel('City', { exact: true }).fill('Leipzig');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(
    page.getByRole('heading', { level: 2, name: 'Land' }),
  ).toBeVisible();
  await page.getByLabel('Address', { exact: true }).fill('Parkweg 1');
  await page.getByLabel('Postal code', { exact: true }).fill('04103');
  await page.getByLabel('Municipality', { exact: true }).fill('Leipzig');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(
    page.getByRole('heading', { level: 2, name: 'House' }),
  ).toBeVisible();
  await page.getByLabel('Living area, m²', { exact: true }).fill('180');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(
    page.getByRole('heading', { level: 2, name: 'Budget' }),
  ).toBeVisible();
  await expect(page.getByTestId('estimate-value-MATERIALS')).not.toHaveText(
    '€0.00',
  );
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(
    page.getByRole('heading', { level: 2, name: 'Review' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Create project' }).click();

  await expect(page).toHaveURL(/\/projects\/[^/]+\/land$/);
  const projectId = decodeURIComponent(
    /\/projects\/([^/]+)\/land$/.exec(page.url())?.[1] ?? '',
  );
  expect(projectId).not.toBe('');

  const snapshot = await (
    await request.get(`/api/projects/${projectId}`)
  ).json();
  const materialLines = new Set(
    snapshot.budgetLines
      .filter((l: { category: string }) => l.category === 'MATERIALS')
      .map((l: { id: string }) => l.id),
  );
  expect(
    snapshot.items.filter((i: { budgetLineId: string }) =>
      materialLines.has(i.budgetLineId),
    ).length,
  ).toBeGreaterThan(0);
  expect(snapshot.project.isTemplate).toBe(false);

  await page.goto('/projects');
  await expect(page.getByText(name)).toBeVisible();

  await page.goto(`/projects/${projectId}/materials/concrete`);
  await expect(
    page.getByRole('table').first().getByRole('row').nth(1),
  ).toBeVisible();
});
