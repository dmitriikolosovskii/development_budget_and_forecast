import { makeItem, makeLine, makeOrg, makeSnapshot } from '@default-project/budget-engine';
import {
  applyItemPatch,
  applyItemsPatch,
  applyLinePatch,
  applyOrgPatch,
  applyProjectPatch,
  normalise,
  overlayUnconfirmed,
  removeItem,
  replaceItem,
  upsertItem,
} from './project-cache';

function fixture() {
  const l1 = makeLine({ id: 'l1', section: 'electrical' });
  const l2 = makeLine({ id: 'l2', section: 'plumbing' });
  const work = makeItem({ id: 'w', budgetLineId: 'l2', kind: 'WORK', code: 'WRK-PLU-001' });
  const a = makeItem({ id: 'a', budgetLineId: 'l1', code: 'MAT-ELE-002', sortOrder: 1 });
  const b = makeItem({ id: 'b', budgetLineId: 'l1', code: 'MAT-ELE-001', sortOrder: 1, requiredForWorkId: 'w' });
  const org = makeOrg({ id: 'o1' });
  return normalise(makeSnapshot({ budgetLines: [l1, l2], items: [a, b, work], organizations: [org] }));
}

describe('project-cache', () => {
  it('should index rows and order line ids by sortOrder then code when normalising', () => {
    const cache = fixture();

    expect(cache.itemIdsByLineId).toEqual({ l1: ['b', 'a'], l2: ['w'] });
    expect(cache.itemsById['a'].code).toBe('MAT-ELE-002');
    expect(cache.linesById['l2'].section).toBe('plumbing');
    expect(cache.orgsById['o1'].name).toBeTruthy();
  });

  it('should keep every other reference when one row is patched [AC-02.6]', () => {
    const cache = fixture();

    const next = applyItemPatch(cache, 'a', { qtyMilli: 5000 });

    expect(next.itemsById['a'].qtyMilli).toBe(5000);
    expect(next.items.find((i) => i.id === 'a')?.qtyMilli).toBe(5000);
    expect(next.itemsById['b']).toBe(cache.itemsById['b']);
    expect(next.itemIdsByLineId).toBe(cache.itemIdsByLineId);
    expect(next.linesById).toBe(cache.linesById);
  });

  it('should move a row between lines and keep untouched line lists when budgetLineId changes', () => {
    const cache = fixture();
    const extra = upsertItem(cache, makeItem({ id: 'z', budgetLineId: 'l3' }));

    const next = applyItemPatch(extra, 'a', { budgetLineId: 'l2' });

    expect(next.itemIdsByLineId['l1']).toEqual(['b']);
    expect(next.itemIdsByLineId['l2']).toEqual(['w', 'a']); // w.sortOrder 0 < a.sortOrder 1
    expect(next.itemIdsByLineId['l3']).toBe(extra.itemIdsByLineId['l3']);
  });

  it('should return the same cache when the row does not exist', () => {
    const cache = fixture();

    expect(applyItemPatch(cache, 'nope', { qtyMilli: 1 })).toBe(cache);
    expect(removeItem(cache, 'nope')).toBe(cache);
  });

  it('should unlink materials when their work row is removed', () => {
    const cache = fixture();

    const next = removeItem(cache, 'w');

    expect(next.itemsById['w']).toBeUndefined();
    expect(next.itemIdsByLineId['l2']).toEqual([]);
    expect(next.itemsById['b'].requiredForWorkId).toBeNull();
    expect(next.itemsById['a']).toBe(cache.itemsById['a']);
  });

  it('should swap a temp row for the server row', () => {
    const cache = upsertItem(fixture(), makeItem({ id: 'tmp-1', budgetLineId: 'l1', code: 'MAT-ELE-003', sortOrder: 2 }));

    const next = replaceItem(cache, 'tmp-1', makeItem({ id: 'srv-1', budgetLineId: 'l1', code: 'MAT-ELE-003', sortOrder: 2 }));

    expect(next.itemIdsByLineId['l1']).toEqual(['b', 'a', 'srv-1']);
    expect(next.items.some((i) => i.id === 'tmp-1')).toBe(false);
  });

  it('should patch lines, the project and organisations', () => {
    const cache = fixture();

    const next = applyOrgPatch(applyProjectPatch(applyLinePatch(cache, 'l1', { approvedCents: 9 }), { markupBps: 1200 }), 'o1', {
      phone: '+49 1',
    });

    expect(next.linesById['l1'].approvedCents).toBe(9);
    expect(next.budgetLines.find((l) => l.id === 'l1')?.approvedCents).toBe(9);
    expect(next.project.markupBps).toBe(1200);
    expect(next.organizations[0].phone).toBe('+49 1');
  });

  it('should re-apply unconfirmed patches on top of refetched data [AC-02.14]', () => {
    const cache = fixture();

    const next = overlayUnconfirmed(cache, [
      ['item:a', { qtyMilli: 7000 }],
      ['line:l2', { approvedCents: 100 }],
      [`project:${cache.project.id}`, { markupBps: 1000 }],
      ['project:other', { markupBps: 1 }],
    ]);

    expect(next.itemsById['a'].qtyMilli).toBe(7000);
    expect(next.linesById['l2'].approvedCents).toBe(100);
    expect(next.project.markupBps).toBe(1000);
  });
});

describe('applyItemsPatch', () => {
  it('should patch several rows at once and keep the rest of the cache', () => {
    const cache = fixture();

    const next = applyItemsPatch(cache, [
      { id: 'a', patch: { qtyMilli: 11 } },
      { id: 'b', patch: { qtyMilli: 22 } },
      { id: 'missing', patch: { qtyMilli: 33 } },
    ]);

    expect(next.itemsById['a'].qtyMilli).toBe(11);
    expect(next.itemsById['b'].qtyMilli).toBe(22);
    expect(next.itemsById['w']).toBe(cache.itemsById['w']);
    expect(next.itemIdsByLineId).toBe(cache.itemIdsByLineId);
  });
});
