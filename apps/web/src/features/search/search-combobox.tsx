import {
  useId,
  useMemo,
  useState,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import type { SearchResult } from '@default-project/types';
import { cx, FOCUS, SOFT } from '../../ui/cx';
import { ErrorState } from '../../ui/states';
import { Skeleton } from '../../ui/skeleton';
import { Highlight } from './highlight';
import { groupResults, SEARCH_TYPE_LABEL } from './search-labels';
import { useDebouncedValue } from './use-debounced-value';
import {
  isSearchable,
  SEARCH_DEBOUNCE_MS,
  SEARCH_MIN_LENGTH,
  useSearch,
} from './use-search';

export interface SearchComboboxProps {
  inputRef: RefObject<HTMLInputElement | null>;
  /** `popover`: header dropdown; `sheet`: inline list inside the mobile Sheet. */
  variant: 'popover' | 'sheet';
  /** Called after navigating to a result (closes the mobile Sheet). */
  onNavigate?: () => void;
}

/** ARIA combobox: input + grouped listbox, ↑↓ Enter Esc, 250 ms debounce. */
export function SearchCombobox({
  inputRef,
  variant,
  onNavigate,
}: SearchComboboxProps) {
  const navigate = useNavigate();
  const listboxId = useId();
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const term = useDebouncedValue(value.trim(), SEARCH_DEBOUNCE_MS);
  const searchable = isSearchable(term);
  const query = useSearch(term);

  const groups = useMemo(
    () => (searchable ? groupResults(query.data ?? []) : []),
    [searchable, query.data],
  );
  const flat = useMemo(() => groups.flatMap((g) => g.results), [groups]);
  const expanded = open && value.trim() !== '';

  const go = (href: string) => {
    navigate(href);
    setOpen(false);
    setActive(-1);
    onNavigate?.();
  };

  const submit = () => {
    const picked = expanded && active >= 0 ? flat[active] : undefined;
    if (picked) go(picked.href);
    else if (value.trim()) go(`/search?q=${encodeURIComponent(value.trim())}`);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape' && expanded) {
      // First Esc closes the list only; the Sheet (document listener) must not close with it.
      e.stopPropagation();
      setOpen(false);
      setActive(-1);
    }
  };

  const onBlur = (e: FocusEvent<HTMLFormElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null))
      setOpen(false);
  };

  const optionId = (i: number) => `${listboxId}-opt-${i}`;
  let index = -1;

  const panel = expanded && (
    <div
      className={cx(
        'overflow-y-auto bg-surface text-sm',
        variant === 'popover'
          ? 'absolute top-full right-0 left-0 z-40 mt-1 max-h-[70vh] rounded-xl border border-line shadow-[var(--shadow-soft)] animate-fade-in'
          : 'mt-3 max-h-[70vh]',
      )}
    >
      {!searchable ? (
        <p className="px-3 py-3 text-muted">
          {value.trim().length < SEARCH_MIN_LENGTH
            ? `Type at least ${SEARCH_MIN_LENGTH} characters`
            : 'Searching…'}
        </p>
      ) : query.isError ? (
        <ErrorState
          title="Search failed"
          error={query.error}
          retry={() => void query.refetch()}
        />
      ) : query.isPending ? (
        <div className="p-3">
          <Skeleton lines={3} />
        </div>
      ) : flat.length === 0 ? (
        <p className="px-3 py-3 text-muted">No results for “{term}”</p>
      ) : (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Search results"
          className="py-1"
        >
          {groups.map((group) => (
            <li key={group.type} role="presentation">
              <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">
                {SEARCH_TYPE_LABEL[group.type]}
              </p>
              <ul role="group" aria-label={SEARCH_TYPE_LABEL[group.type]}>
                {group.results.map((r) => {
                  index += 1;
                  const i = index;
                  return (
                    <ResultOption
                      key={`${r.type}:${r.id}`}
                      id={optionId(i)}
                      result={r}
                      term={term}
                      active={i === active}
                      onHover={() => setActive(i)}
                      onPick={() => go(r.href)}
                    />
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      onBlur={onBlur}
      className="relative w-full max-w-md"
    >
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="Search"
          aria-autocomplete="list"
          aria-expanded={expanded && flat.length > 0}
          aria-controls={expanded && flat.length > 0 ? listboxId : undefined}
          aria-activedescendant={
            expanded && active >= 0 ? optionId(active) : undefined
          }
          autoComplete="off"
          placeholder="Search projects, items, suppliers…  ⌘K"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cx(
            'w-full rounded-lg border border-line bg-subtle py-1.5 pr-3 pl-9 text-sm placeholder:text-muted',
            FOCUS,
          )}
        />
      </div>
      {panel}
    </form>
  );
}

interface ResultOptionProps {
  id: string;
  result: SearchResult;
  term: string;
  active: boolean;
  onHover: () => void;
  onPick: () => void;
}

function ResultOption({
  id,
  result,
  term,
  active,
  onHover,
  onPick,
}: ResultOptionProps) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      // Keep focus in the input so blur does not close the list before the click lands.
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={onHover}
      onClick={onPick}
      className={cx(
        'cursor-pointer px-3 py-1.5',
        SOFT,
        active ? 'bg-brand-50' : 'hover:bg-subtle',
      )}
    >
      <span className="block truncate text-ink">
        <Highlight text={result.title} query={term} />
      </span>
      <span className="block truncate text-xs text-muted">
        <Highlight text={result.subtitle} query={term} />
      </span>
    </li>
  );
}
