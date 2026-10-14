/** Joins class names, skipping falsy values. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Shared interactive transition (DESIGN-SYSTEM §2). */
export const SOFT = 'transition-all duration-200 ease-[var(--ease-soft)]';
export const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40';
