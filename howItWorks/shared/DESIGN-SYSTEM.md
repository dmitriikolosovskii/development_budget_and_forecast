# DESIGN-SYSTEM — light, soft tones, smooth transitions (Tailwind 4)

Block 02 implements the tokens and the UI kit. Other blocks **use only the kit and these tokens**. Raw hex values and one-off shadows in features are not allowed.

## 1. Tokens (`apps/web/src/styles.css`, Tailwind 4 `@theme`)

```css
@import "tailwindcss";
@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --color-canvas: #f7f8fb;      /* page background */
  --color-surface: #ffffff;     /* cards, tables */
  --color-subtle: #f1f4f9;      /* hover, zebra, table header */
  --color-line: #e3e8f0;        /* borders */
  --color-ink: #1f2a3d;         /* main text */
  --color-muted: #66728a;       /* secondary text */
  --color-brand-50: #eef4ff;  --color-brand-100: #dbe7ff;  --color-brand-500: #5b7cfa;  --color-brand-600: #4a67e0;
  --color-ok-50: #ecfaf3;     --color-ok-600: #1f9d6b;     /* within budget / on time */
  --color-warn-50: #fff7e8;   --color-warn-600: #c98411;   /* at risk */
  --color-risk-50: #fdeff0;   --color-risk-600: #d1495b;   /* overrun / late */
  --color-info-50: #eef8fc;   --color-info-600: #2b8cb3;
  --radius-card: 1rem;
  --shadow-soft: 0 1px 2px rgb(31 42 61 / 0.04), 0 4px 16px rgb(31 42 61 / 0.06);
  --ease-soft: cubic-bezier(.2,.8,.2,1);
}
```
Chart colours (recharts), in a fixed order: Budget `#9db4ff`, Actual `#5b7cfa`, Commitments `#7cc8e8`, Forecast `#f2a65a`, Overrun `#d1495b`, Profit `#1f9d6b`. Categories: LAND `#8fb9a8`, ARCHITECTURE `#b49fdc`, MATERIALS `#f2c38b`, CONSTRUCTION `#7fa7e6`, MARKETING `#f19fb5`.

## 2. Motion

- Everything interactive: `transition-all duration-200 ease-[var(--ease-soft)]`.
- Tab / sub-tab switch: content `animate-[fade-in_180ms]` (opacity 0→1, translateY 4px→0). The active-tab underline moves smoothly.
- Sidebar: width 272px ↔ 76px (`transition-[width] duration-300`); labels fade out.
- Modal: overlay fades in, panel scale 0.98→1 + fade in. On mobile the modal is a bottom sheet (slides up).
- A changed number (KPI, cell amount) flashes briefly (`bg-brand-50` → transparent, 600 ms).
- Honour `prefers-reduced-motion: reduce`: turn the animations off.

## 3. Responsive layout

| Breakpoint | Layout |
|---|---|
| `< 640` (mobile) | Header with burger menu, sidebar as an off-canvas drawer. Project tabs are a horizontal chip scroller. Sub-sections are a `select`/chips at the top. Tables become **row cards** (key fields + "Edit" opens a sheet). KPI strip: 2 columns. |
| `640–1023` (tablet) | Sidebar collapsed to icons by default. Tables scroll horizontally with a sticky first column. KPI strip: 3 columns. |
| `1024–1535` (laptop) | Sidebar expanded (can be collapsed). Sub-sections in a left column of 220px. KPI strip: 5 columns. |
| `≥ 1536` (wide) | Content max-w 1600px, centred. The Budget health panel sits on the right as a sticky column next to the table. |

## 4. Layout

```
┌ Header: ☰ · logo "Kairon Budget" · GlobalSearch (⌘K) · project selector · HealthBadge ┐
├ Sidebar (collapsible) ─┬ Content ─────────────────────────────────────────────────────┤
│ ▸ Projects             │ Breadcrumbs                                                    │
│    Calculate project   │ Project header: name, city, status, KPI strip (5 CFO answers) │
│    Current projects    │ Tabs: Land · Architecture · Building materials · Construction  │
│ ▸ Delivery tracking    │       · Marketing · Profitability                              │
│ ▸ Analytics            │ ┌ Sub-nav ┬ Table / content ─────────┬ BudgetHealthPanel ┐   │
│ ⟨⟨ collapse            │ └─────────┴──────────────────────────┴───────────────────┘   │
└────────────────────────┴───────────────────────────────────────────────────────────────┘
```

## 5. UI kit (`apps/web/src/ui/`, block 02)

| Component | Purpose / API (summary) |
|---|---|
| `Card`, `SectionTitle`, `Badge(tone)`, `Pill`, `Skeleton`, `EmptyState`, `ErrorState(retry)`, `ComingSoon(title)` | Basic building blocks |
| `Tabs` (route-based), `SubNav(items, active, onSelect)` | Tabs and sub-sections; the URL is the source of truth |
| `KpiStrip(summary)` | Budget · Spent · Open commitments · Forecast (EAC) · Variance (+ "N lines over budget") |
| `BudgetHealthPanel({projectId, category?, lineId?})` | **The CFO's 5 answers for the current scope**: approved, actual, exposure (actual + open commitments), forecast, variance, overrun lines (click → navigate) and a progress bar spent/committed/forecast against the budget |
| `EditableTable<Row>({rowIds, useRow, columns, onEdit, onAdd, onDelete, footer})` | Rows `memo`, cell editors, keyboard (Enter/Tab/Esc), sticky header, footer total, mobile = cards |
| Cells: `TextCell`, `MoneyCell`, `QtyCell(unit)`, `DateCell`, `SelectCell`, `StatusCell(ItemStatus)`, `OrgCell(orgId → modal)`, `ScheduleFlagCell(result)` | Display + editor; money/quantity are parsed with engine functions |
| `Modal`, `Sheet`, `Toast` (`useToast`) | Overlays |
| `OrganizationModal({orgId, projectId})` (`features/organizations/`) | Details, contact person and role, phone/email (tel:/mailto:), payment terms, rating, **deadlines for this organisation in the project** (its rows with dates and schedule statuses) |
| `ChartCard`, chart wrappers (recharts `ResponsiveContainer`) | Unified tooltip, legend and colours |

Number formats: money `€12,345.67` (whole euros in KPIs: `€12,346`), percent `15.0 %`, dates `14 Oct 2026` (`en-GB`), quantity `12.5 m³`.
Statuses: ON_TIME → ok, AT_RISK → warn, LATE_FOR_WORK/OVERDUE → risk, DELIVERED → info, UNSCHEDULED → muted.
Accessibility: every icon button has an `aria-label`, focus ring `ring-2 ring-brand-500/40`, contrast ≥ 4.5:1 for text.
