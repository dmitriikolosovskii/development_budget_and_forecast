import { expect, test, type APIRequestContext } from '@playwright/test';

interface PortfolioRow {
  projectId: string;
  slug: string;
  name: string;
  status: string;
  summary: { approved: number; forecast: number };
}
interface Portfolio {
  totals: { approved: number };
  projects: PortfolioRow[];
}

async function portfolio(request: APIRequestContext): Promise<Portfolio> {
  const res = await request.get('/api/analytics/portfolio');
  expect(res.ok()).toBeTruthy();
  return res.json();
}

let copy: { id: string; name: string };

// Every e2e test works on a copy of the demo project (CONTRACTS §5); copies accumulate, so no absolute counts.
test.beforeEach(async ({ request }) => {
  const list = await (await request.get('/api/projects')).json();
  const taucha = list.find(
    (p: { slug: string }) => p.slug === 'taucha-stadtvilla',
  );
  const name = `Analytics copy ${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const res = await request.post(`/api/projects/${taucha.id}/duplicate`, {
    data: { name },
  });
  expect(res.ok()).toBeTruthy();
  const snapshot = await res.json();
  copy = { id: snapshot.project.id, name };
});

test('should include a duplicated project in the portfolio totals and table [AC-11.13]', async ({
  page,
  request,
}) => {
  const data = await portfolio(request);
  const taucha = data.projects.find((p) => p.slug === 'taucha-stadtvilla');
  const row = data.projects.find((p) => p.projectId === copy.id);
  expect(row?.summary.approved).toBe(taucha?.summary.approved);
  expect(data.totals.approved).toBe(
    data.projects.reduce((s, p) => s + p.summary.approved, 0),
  );
  expect(data.projects.some((p) => p.slug.startsWith('template'))).toBe(false);

  await page.goto('/analytics');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Analytics' }),
  ).toBeVisible();
  const link = page
    .getByRole('table', { name: 'Projects' })
    .getByRole('link', { name: copy.name });
  await expect(link).toBeVisible();
  await link.click();

  await expect(page).toHaveURL(
    new RegExp(`/projects/${copy.id}/profitability$`),
  );
});

test('should leave only the completed Markranstädt project when filtering by Completed [AC-11.5]', async ({
  page,
}) => {
  await page.goto('/analytics');
  await page.getByLabel('Status').selectOption('COMPLETED');

  const rows = page.getByRole('table', { name: 'Projects' }).getByRole('row');
  await expect(rows).toHaveCount(2); // header + 1
  await expect(rows.nth(1)).toContainText('Markranstädt');
  await expect(
    page
      .getByRole('table', { name: 'Projects' })
      .getByRole('link', { name: copy.name }),
  ).toHaveCount(0);
});
