import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { SearchResultType } from '@default-project/types';
import { Card } from '../../ui/card';
import { cx, FOCUS, SOFT } from '../../ui/cx';
import { Skeleton } from '../../ui/skeleton';
import { EmptyState, ErrorState } from '../../ui/states';
import { Highlight } from './highlight';
import {
  groupResults,
  isSearchResultType,
  SEARCH_TYPE_LABEL,
} from './search-labels';
import { isSearchable, SEARCH_MIN_LENGTH, useSearch } from './use-search';

/** `/search?q=&type=`: every result of the query, grouped, with type filter chips (state lives in the URL). */
export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const rawType = params.get('type');
  const type = isSearchResultType(rawType) ? rawType : null;
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);

  const query = useSearch(q);
  const searchable = isSearchable(q);
  const all = searchable ? (query.data ?? []) : [];
  const groups = groupResults(type ? all.filter((r) => r.type === type) : all);
  const counts = groupResults(all);

  const setType = (next: SearchResultType | null) => {
    const p = new URLSearchParams(params);
    if (next) p.set('type', next);
    else p.delete('type');
    setParams(p);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams(params);
    p.set('q', draft.trim());
    setParams(p);
  };

  let body;
  if (!searchable) {
    body = (
      <EmptyState
        title={
          q
            ? `Type at least ${SEARCH_MIN_LENGTH} characters`
            : 'Search the whole app'
        }
        description="Projects, cost items, organizations and budget lines."
      />
    );
  } else if (query.isError) {
    body = (
      <ErrorState
        title="Search failed"
        error={query.error}
        retry={() => void query.refetch()}
      />
    );
  } else if (query.isPending) {
    body = <Skeleton lines={6} />;
  } else if (all.length === 0) {
    body = (
      <EmptyState
        title={`No results for “${q}”`}
        description="Try a code like MAT-ELE-001, a city or a supplier."
      />
    );
  } else if (groups.length === 0) {
    body = (
      <EmptyState
        title={`No ${type ? SEARCH_TYPE_LABEL[type].toLowerCase() : 'results'} for “${q}”`}
      />
    );
  } else {
    body = (
      <div className="space-y-4">
        {groups.map((group) => (
          <section key={group.type} aria-label={SEARCH_TYPE_LABEL[group.type]}>
            <h2 className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">
              {SEARCH_TYPE_LABEL[group.type]}
            </h2>
            <ul className="divide-y divide-line">
              {group.results.map((r) => (
                <li key={`${r.type}:${r.id}`}>
                  <Link
                    to={r.href}
                    className={cx(
                      'block rounded-lg px-2 py-2 hover:bg-subtle',
                      SOFT,
                      FOCUS,
                    )}
                  >
                    <span className="block text-ink">
                      <Highlight text={r.title} query={q} />
                    </span>
                    <span className="block text-sm text-muted">
                      <Highlight text={r.subtitle} query={q} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  const chip = (
    label: string,
    count: number,
    value: SearchResultType | null,
  ) => (
    <button
      key={value ?? 'all'}
      type="button"
      aria-pressed={type === value}
      onClick={() => setType(value)}
      className={cx(
        'rounded-full border px-3 py-1 text-sm',
        SOFT,
        FOCUS,
        type === value
          ? 'border-brand-500 bg-brand-50 text-brand-600'
          : 'border-line bg-surface text-muted hover:bg-subtle',
      )}
    >
      {label} <span className="tabular-nums">({count})</span>
    </button>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 animate-fade-in">
      <h1 className="text-xl font-semibold text-ink">Search</h1>
      <form
        role="search"
        aria-label="Search page"
        onSubmit={onSubmit}
        className="flex gap-2"
      >
        <input
          type="search"
          aria-label="Search query"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Projects, cost items, organizations, budget lines"
          className={cx(
            'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm',
            FOCUS,
          )}
        />
        <button
          type="submit"
          className={cx(
            'rounded-lg bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600',
            SOFT,
            FOCUS,
          )}
        >
          Search
        </button>
      </form>
      {searchable && all.length > 0 && (
        <div
          role="group"
          aria-label="Filter by type"
          className="flex flex-wrap gap-2"
        >
          {chip('All', all.length, null)}
          {counts.map((g) =>
            chip(SEARCH_TYPE_LABEL[g.type], g.results.length, g.type),
          )}
        </div>
      )}
      <Card>{body}</Card>
    </div>
  );
}
