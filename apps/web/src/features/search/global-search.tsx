import { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useIsMobile } from '../../lib/use-media-query';
import { cx, FOCUS } from '../../ui/cx';
import { Sheet } from '../../ui/modal';
import { SearchCombobox } from './search-combobox';

/** Header search: a combobox on tablet/desktop, an icon opening a Sheet on mobile. ⌘K / Ctrl+K opens it. */
export function GlobalSearch() {
  const isMobile = useIsMobile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isMobile) setSheetOpen(true);
        else {
          inputRef.current?.focus();
          inputRef.current?.select();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isMobile]);

  // Modal focuses its panel when it opens (child effect); this parent effect runs after it.
  useEffect(() => {
    if (sheetOpen) inputRef.current?.focus();
  }, [sheetOpen]);

  if (!isMobile)
    return <SearchCombobox inputRef={inputRef} variant="popover" />;
  return (
    <div className="flex w-full justify-end">
      <button
        type="button"
        aria-label="Open search"
        onClick={() => setSheetOpen(true)}
        className={cx('rounded-lg p-1.5 text-ink hover:bg-subtle', FOCUS)}
      >
        <Search aria-hidden className="h-5 w-5" />
      </button>
      <Sheet open={sheetOpen} onClose={closeSheet} title="Search">
        <div className="min-h-[60vh]">
          <SearchCombobox
            inputRef={inputRef}
            variant="sheet"
            onNavigate={closeSheet}
          />
        </div>
      </Sheet>
    </div>
  );
}
