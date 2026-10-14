/**
 * Colours for the SVG drawings. They are inlined (not Tailwind classes) so a downloaded SVG looks the same
 * outside the app; the values are the DESIGN-SYSTEM §1 tokens.
 */
export const DRAW = {
  ink: '#1f2a3d',
  muted: '#66728a',
  line: '#e3e8f0',
  surface: '#ffffff',
  wall: '#66728a',
  brand: '#5b7cfa',
  risk: '#d1495b',
  riskSoft: '#fdeff0',
  okSoft: '#ecfaf3',
  ok: '#1f9d6b',
} as const;

/** Soft room fills by kind. */
export const ROOM_FILL: Record<string, string> = {
  living: '#eef4ff',
  kitchen: '#fff7e8',
  bedroom: '#eef8fc',
  bath: '#ecfaf3',
  wc: '#ecfaf3',
  hall: '#f1f4f9',
  stairs: '#f1f4f9',
  utility: '#f7f8fb',
  storage: '#f7f8fb',
  office: '#dbe7ff',
};
