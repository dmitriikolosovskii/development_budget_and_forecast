import { afterEach, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { makeItem, makeLine, makeOrg, makeSnapshot } from '@default-project/budget-engine';
import type { CostItem, Delivery, ProjectSnapshot } from '@default-project/types';
import { App } from '../../app/app';
import { autosaveQueue } from '../../lib/autosave-queue';
import { queryKeys } from '../../lib/query-keys';
import { useToastStore } from '../../lib/toast-store';
import { useUiStore } from '../../lib/ui-store';
import { normalise, type ProjectCache } from '../project/project-cache';

export const PID = 'project-1';

// Local copies of testing/render.tsx helpers: this file is type-checked with the app (not spec) tsconfig.
export function fakeResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, text: async () => JSON.stringify(body ?? ''), json: async () => body } as Response;
}

const testQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } });

/**
 * Seed-like fixture (today = 2026-10-14):
 * - concrete: over budget, delivered (with a DELIVERED delivery) → `Delivered`, actual locked;
 * - masonry: delivery 2026-10-10, no work → `Overdue`;
 * - windows-doors: windows arrive 2026-10-28 for a work starting 2026-10-19 → `Late for work · 9 d`; codes 001 and 003;
 * - electrical: NYM-J cable + sockets, over budget (forecast 625.00 against 600.00).
 */
export function materialsSnapshot(): ProjectSnapshot {
  const supplier = makeOrg({ id: 'org-sup', name: 'Elektro-Großhandel Sachsen GmbH', role: 'SUPPLIER', phone: '+49 341 555 0101' });
  const installer = makeOrg({ id: 'org-inst', name: 'Elektro Krause e.K.', role: 'CONTRACTOR', phone: '+49 341 555 0202' });
  const lines = [
    makeLine({ id: 'l-con', category: 'MATERIALS', section: 'concrete', name: 'Concrete & reinforcement', approvedCents: 308_000, sortOrder: 10 }),
    makeLine({ id: 'l-mas', category: 'MATERIALS', section: 'masonry', name: 'Masonry', approvedCents: 500_000, sortOrder: 20 }),
    makeLine({ id: 'l-win', category: 'MATERIALS', section: 'windows-doors', name: 'Windows, doors & stairs', approvedCents: 1_000_000, sortOrder: 40 }),
    makeLine({ id: 'l-ele', category: 'MATERIALS', section: 'electrical', name: 'Electrical', approvedCents: 60_000, sortOrder: 60 }),
    makeLine({ id: 'l-wi', category: 'CONSTRUCTION', section: 'windows-install', name: 'Window, door & stair installation', approvedCents: 200_000, sortOrder: 50 }),
  ];
  const items: CostItem[] = [
    makeItem({ id: 'w-win', budgetLineId: 'l-wi', kind: 'WORK', code: 'WRK-WIN-001', name: 'Window installation', unit: 'lump', qtyMilli: 1000, unitPriceCents: 150_000, startDate: '2026-10-19', endDate: '2026-10-30' }),
    makeItem({ id: 'c1', budgetLineId: 'l-con', code: 'MAT-CON-001', name: 'Ready-mix concrete C25/30', unit: 'm3', qtyMilli: 20_000, unitPriceCents: 19_250, committedCents: 385_000, actualCents: 385_000, status: 'DONE', deliveryDate: '2026-06-15', deliveredDate: '2026-06-15' }),
    makeItem({ id: 'm1', budgetLineId: 'l-mas', code: 'MAT-MAS-001', name: 'Sand-lime blocks KS 17.5', unit: 'm2', qtyMilli: 1000, unitPriceCents: 100_000, deliveryDate: '2026-10-10' }),
    makeItem({ id: 'w1', budgetLineId: 'l-win', code: 'MAT-WIN-001', name: 'Triple-glazed windows', unit: 'pcs', qtyMilli: 8000, unitPriceCents: 60_000, status: 'CONTRACTED', committedCents: 480_000, deliveryDate: '2026-10-28', requiredForWorkId: 'w-win' }),
    makeItem({ id: 'w3', budgetLineId: 'l-win', code: 'MAT-WIN-003', name: 'Front door', unit: 'pcs', qtyMilli: 1000, unitPriceCents: 250_000, deliveryDate: '2026-10-16', sortOrder: 1 }),
    makeItem({ id: 'e1', budgetLineId: 'l-ele', code: 'MAT-ELE-001', name: 'NYM-J 3×1.5 mm² cable', unit: 'm', qtyMilli: 500_000, unitPriceCents: 89, supplierId: 'org-sup', contractorId: 'org-inst', deliveryDate: '2026-11-20' }),
    makeItem({ id: 'e2', budgetLineId: 'l-ele', code: 'MAT-ELE-002', name: 'Schuko sockets', unit: 'pcs', qtyMilli: 40_000, unitPriceCents: 450, deliveryDate: '2026-11-20', sortOrder: 1 }),
  ];
  const deliveries: Delivery[] = [
    { id: 'd1', projectId: PID, costItemId: 'c1', batchId: null, deliveryNoteNo: 'LS-1001', kind: 'DELIVERED', date: '2026-06-15', qtyMilli: 20_000, invoiceCents: 385_000, createdAt: '2026-10-14T00:00:00.000Z' },
  ];
  return makeSnapshot({ budgetLines: lines, items, organizations: [supplier, installer], deliveries });
}

export interface Call {
  method: string;
  url: string;
  body: Record<string, unknown> | undefined;
}

/** A fetch mock that answers like the API (PATCH echoes the merged row, POST creates, DELETE 204) and records calls. */
export function mockMaterialsApi(snapshot = materialsSnapshot(), overrides: Partial<Record<string, (call: Call) => Response>> = {}) {
  const calls: Call[] = [];
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const method = init?.method ?? 'GET';
    const url = String(input);
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
    const call = { method, url, body };
    calls.push(call);
    const override = overrides[`${method} ${url}`] ?? overrides[method];
    if (override) return override(call);
    if (method === 'GET' && url === `/api/projects/${PID}`) return fakeResponse(snapshot);
    if (method === 'GET' && url === '/api/organizations') return fakeResponse(snapshot.organizations);
    const item = /^\/api\/projects\/[^/]+\/items\/([^/]+)$/.exec(url);
    if (method === 'PATCH' && item) {
      const prev = snapshot.items.find((i) => i.id === item[1]);
      return fakeResponse({ ...prev, ...body });
    }
    if (method === 'DELETE' && item) return fakeResponse(undefined, 204);
    if (method === 'POST' && url === `/api/projects/${PID}/items`) {
      return fakeResponse(makeItem({ ...(body as Partial<CostItem>), id: `new-${calls.length}`, projectId: PID }));
    }
    const line = /^\/api\/projects\/[^/]+\/budget-lines\/([^/]+)$/.exec(url);
    if (method === 'PATCH' && line) {
      const prev = snapshot.budgetLines.find((l) => l.id === line[1]);
      return fakeResponse({ ...prev, ...body });
    }
    return fakeResponse({ message: `No mock for ${method} ${url}` }, 404);
  });
  const of = (method: string) => calls.filter((c) => c.method === method);
  return { spy, calls, of };
}

let currentPath = '';
function LocationProbe() {
  const location = useLocation();
  currentPath = `${location.pathname}${location.search}`;
  return null;
}
export const lastPath = () => currentPath;

/** Renders the whole app (shell flushes autosave on route change) on a seeded cache. */
export function renderMaterials(url = `/projects/${PID}/materials/electrical`, snapshot = materialsSnapshot()) {
  const client = testQueryClient();
  client.setQueryData<ProjectCache>(queryKeys.project(PID), normalise(snapshot));
  client.setQueryData(queryKeys.organizations(), snapshot.organizations);
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <App />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { client, ...view };
}

/** Fake timers + synchronous TanStack notifications (see features/project/use-edit-item.spec.tsx). */
export function useFakeClock() {
  beforeEach(() => {
    vi.useFakeTimers();
    notifyManager.setScheduler((cb) => cb());
    autosaveQueue.__reset();
    useToastStore.setState({ toasts: [] });
    useUiStore.setState({ lastSection: {} });
  });
  afterEach(() => {
    autosaveQueue.__reset();
    notifyManager.setScheduler((cb) => setTimeout(cb, 0));
    vi.useRealTimers();
  });
}

/** Lets promises, TanStack notifications and renders run (several rounds: fetch → queue → cache → render). */
export async function settle() {
  for (let i = 0; i < 3; i++) await act(() => vi.advanceTimersByTimeAsync(0));
}

export const row = (id: string) => {
  const el = document.querySelector<HTMLElement>(`[data-row-id="${id}"]`);
  if (!el) throw new Error(`row ${id} is not rendered`);
  return el;
};

/** Value of a KPI in the project header strip (the first occurrence of the label on the page). */
export const kpi = (label: string) => screen.getAllByText(label)[0].nextElementSibling?.textContent;
