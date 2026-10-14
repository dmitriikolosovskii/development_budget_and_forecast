import { act, screen } from '@testing-library/react';
import { notifyManager } from '@tanstack/react-query';
import { Route, Routes } from 'react-router-dom';
import { autosaveQueue } from '../../lib/autosave-queue';
import { queryKeys } from '../../lib/query-keys';
import { renderWithProviders, testQueryClient } from '../../testing/render';
import {
  applyItemPatch,
  normalise,
  type ProjectCache,
} from '../project/project-cache';
import { constructionSnapshot, PID } from './construction-fixture';
import { ConstructionPage } from './construction-page';

// Counts row renders: EditableTable calls every column's `cell` only when the row itself renders.
const renders = vi.hoisted(() => ({}) as Record<string, number>);
vi.mock('./construction-columns', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./construction-columns')>();
  return {
    CONSTRUCTION_COLUMNS: mod.CONSTRUCTION_COLUMNS.map((c, i) =>
      i === 0
        ? {
            ...c,
            cell: (
              row: Parameters<typeof c.cell>[0],
              edit: Parameters<typeof c.cell>[1],
            ) => {
              renders[row.id] = (renders[row.id] ?? 0) + 1;
              return c.cell(row, edit);
            },
          }
        : c,
    ),
  };
});

const KEY = queryKeys.project(PID);
const settle = async () => {
  for (let i = 0; i < 3; i++) await act(() => vi.advanceTimersByTimeAsync(0));
};

describe('ConstructionPage re-renders', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    notifyManager.setScheduler((cb) => cb());
    autosaveQueue.__reset();
  });
  afterEach(() => {
    autosaveQueue.__reset();
    notifyManager.setScheduler((cb) => setTimeout(cb, 0));
    vi.useRealTimers();
  });

  it('should re-render only the edited work row, not its neighbours [AC-05.13]', async () => {
    const snapshot = constructionSnapshot({
      items: (items) =>
        items.map((i) =>
          i.id === 'w-hea'
            ? { ...i, budgetLineId: 'l-win-inst', code: 'WRK-WIN-002' }
            : i,
        ),
    });
    const client = testQueryClient();
    client.setQueryData<ProjectCache>(KEY, normalise(snapshot));
    renderWithProviders(
      <Routes>
        <Route
          path="/projects/:projectId/construction/:section?"
          element={<ConstructionPage />}
        />
      </Routes>,
      { url: `/projects/${PID}/construction/windows-install`, client },
    );
    await settle();
    expect(screen.getByText('WRK-WIN-002')).toBeTruthy();
    for (const k of Object.keys(renders)) delete renders[k];

    act(() => {
      client.setQueryData<ProjectCache>(
        KEY,
        (c) =>
          c && applyItemPatch(c, 'w-win', { name: 'Window installation (2)' }),
      );
    });
    await settle();
    // A material delivery change alters the schedule of w-win only: no row re-render at all.
    act(() => {
      client.setQueryData<ProjectCache>(
        KEY,
        (c) => c && applyItemPatch(c, 'm-win', { deliveryDate: '2026-10-19' }),
      );
    });
    await settle();

    expect(renders['w-win']).toBe(1);
    expect(renders['w-hea']).toBeUndefined();
  });
});
