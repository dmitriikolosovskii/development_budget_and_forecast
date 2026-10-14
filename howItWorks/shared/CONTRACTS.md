# CONTRACTS — single source of truth (frozen at the `w0-frozen` tag)

Block 01 transcribes §1–§6 into code (schema, zod, engine, API). Block 02 implements §6–§7 on the web side.
Any divergence is a CR (PROTOCOL §4). `CONTRACT_VERSION = 2` (a constant in `libs/shared/types/src/lib/version.ts`).

---

## 1. Units and conventions

| Value | Type | Example |
|---|---|---|
| Money | `Int`, **euro cents, net (excl. VAT)** | €1,234.56 → `123456` |
| Quantity | `Int`, **milli-units** | 12.5 m³ → `12500` |
| Percent/rate | `Int`, **basis points** | 15% → `1500` |
| Calendar date | `String` `YYYY-MM-DD` (lexicographic comparison = date comparison) | `"2026-11-03"` |
| Geometry (drawing) | `Int`, **centimetres** | 10.40 m → `1040` |
| Plot area | `Int`, m² | `540` |
| Timestamps | Prisma `DateTime` (`createdAt`, `updatedAt` only) | |
| Ids | `String @id @default(cuid())` + stable `slug`/`code` for idempotent seeding. Duplicated rows get `randomUUID()` ids, so zod id schemas are `z.string().min(1)` (as-built 01) | |

- Limit: every money and quantity field in a DTO is `@IsInt() @Min(0) @Max(2_000_000_000)` (Prisma `Int` is 32-bit). This is documented in SOLUTION.md.
- Formatting: `formatEur(cents)` → `€1,234.56` (`Intl.NumberFormat('en-IE', {style:'currency',currency:'EUR'})`). Parsing user input `parseEurToCents("1,234.56")` works **on strings, never via float**. Same for `formatQty`/`parseQtyToMilli`.
- Units (`unit`): `m3 | m2 | m | t | kg | pcs | h | set | lump` (labels: m³, m², m, t, kg, pcs, h, set, lump sum).

## 2. Data model (Prisma, SQLite) — block 01 creates it in ONE migration `init`

```prisma
enum CostCategory { LAND ARCHITECTURE MATERIALS CONSTRUCTION MARKETING }
enum ItemKind     { MATERIAL WORK SERVICE }          // SERVICE = fees, taxes, marketing, land
enum ItemStatus   { PLANNED PARTIAL CONTRACTED DONE }
enum ProjectStatus{ PLANNING ACTIVE COMPLETED }
enum OrgRole      { SUPPLIER CONTRACTOR CONSULTANT AGENCY AUTHORITY }
enum UtilityType  { WATER SEWER STORMWATER POWER GAS TELECOM DISTRICT_HEATING }
enum UtilityStatus{ CONNECTED AT_BOUNDARY IN_STREET NOT_AVAILABLE }
enum HouseSection { SITE_FOUNDATION STRUCTURE ROOF OPENINGS ELECTRICAL PLUMBING HEATING_VENTILATION INTERIOR_FINISHES FACADE_INSULATION EXTERIOR }
enum DeliveryKind { EXPECTED DELIVERED }

model Project {
  id String @id @default(cuid())
  slug String @unique
  name String
  code String                      // "KF-2026-01"
  status ProjectStatus @default(PLANNING)
  isTemplate Boolean @default(false) // template for the wizard, hidden from lists
  clientName String
  city String
  startDate String                 // YYYY-MM-DD
  endDate String
  markupBps Int @default(1500)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  budgetLines BudgetLine[]  items CostItem[]  land LandParcel?  plan ArchitecturePlan?
  deliveries Delivery[]  importBatches ImportBatch[]
}

model BudgetLine {                 // a budget line = a tab sub-section
  id String @id @default(cuid())
  projectId String
  category CostCategory
  section String                   // slug: "electrical" (see §4)
  name String                      // "Electrical"
  approvedCents Int                // approved budget for the line
  sortOrder Int @default(0)
  createdAt DateTime @default(now())  updatedAt DateTime @updatedAt
  project Project @relation(fields:[projectId], references:[id], onDelete: Cascade)
  items CostItem[]
  @@unique([projectId, category, section])
}

model CostItem {                   // one table row on any tab
  id String @id @default(cuid())
  projectId String
  budgetLineId String
  kind ItemKind
  code String                      // "MAT-ELE-003" — unique within the project; CSV import key
  name String
  description String?
  unit String
  qtyMilli Int
  unitPriceCents Int
  committedCents Int @default(0)   // contract/order amount (commitment)
  actualCents Int @default(0)      // invoiced/paid (actual spent)
  status ItemStatus @default(PLANNED)
  supplierId String?               // Organization (materials)
  contractorId String?             // Organization (installer/contractor/agency)
  deliveryDate String?             // MATERIAL: expected/confirmed delivery date
  deliveredDate String?            // MATERIAL: actual delivery date (from delivery tracking)
  startDate String?                // WORK/SERVICE: start
  endDate String?                  // WORK/SERVICE: end
  requiredForWorkId String?        // MATERIAL → the WORK it is needed for (schedule check)
  boqComponentId String?           // MATERIAL → a takeoff row in Architecture
  sortOrder Int @default(0)
  notes String?
  createdAt DateTime @default(now())  updatedAt DateTime @updatedAt
  project Project @relation(fields:[projectId], references:[id], onDelete: Cascade)
  budgetLine BudgetLine @relation(fields:[budgetLineId], references:[id], onDelete: Cascade)
  supplier Organization? @relation("supplier", fields:[supplierId], references:[id])
  contractor Organization? @relation("contractor", fields:[contractorId], references:[id])
  requiredForWork CostItem? @relation("needs", fields:[requiredForWorkId], references:[id], onDelete: SetNull)
  requiredMaterials CostItem[] @relation("needs")
  boqComponent BoqComponent? @relation(fields:[boqComponentId], references:[id], onDelete: SetNull)
  deliveries Delivery[]
  @@unique([projectId, code])
  @@index([budgetLineId])
}

model Organization {               // shared across all projects
  id String @id @default(cuid())
  slug String @unique
  name String
  role OrgRole
  legalForm String?                // GmbH, GmbH & Co. KG, e.K.
  address String
  city String
  website String?
  email String
  phone String
  contactPerson String             // responsible person
  contactRole String               // "Project manager"
  paymentTermsDays Int @default(30)
  rating Int?                      // 1..5
  notes String?
  createdAt DateTime @default(now())  updatedAt DateTime @updatedAt
  suppliedItems CostItem[] @relation("supplier")
  contractedItems CostItem[] @relation("contractor")
}

model LandParcel {
  id String @id @default(cuid())
  projectId String @unique
  address String  postalCode String  municipality String  district String?  state String  // Bundesland
  cadastralRef String?             // "Gemarkung X, Flur 3, Flurstück 512/4"
  lat Float  lng Float
  areaM2 Int  plotWidthCm Int  plotDepthCm Int
  landValuePerM2Cents Int          // Bodenrichtwert
  zoningPlan String                // B-Plan
  grzBps Int  gfzBps Int  maxStoreys Int  roofRules String  buildingLineNotes String?
  soilType String  soilClass String  bearingCapacityKnM2 Int?  groundwaterDepthCm Int?
  contaminationNotes String?  slopeNotes String?  orientation String?  notes String?
  createdAt DateTime @default(now())  updatedAt DateTime @updatedAt
  project Project @relation(fields:[projectId], references:[id], onDelete: Cascade)
  utilities UtilityConnection[]
}

model UtilityConnection {
  id String @id @default(cuid())
  landId String
  type UtilityType
  status UtilityStatus
  distanceM Int?  provider String?  notes String?
  land LandParcel @relation(fields:[landId], references:[id], onDelete: Cascade)
  @@unique([landId, type])
}

model ArchitecturePlan {
  id String @id @default(cuid())
  projectId String @unique
  name String                      // "EFH 'Familie 4' — 146 m²"
  architectOrgId String?           // Organization (CONSULTANT)
  style String  storeys Int  roofType String  roofPitchDeg Int
  energyStandard String            // "KfW EH 55 / GEG 2024"
  heatingSystem String             // "Air-source heat pump + underfloor heating"
  occupants Int @default(4)
  footprintWidthCm Int  footprintDepthCm Int
  siteOffsetXcm Int  siteOffsetYcm Int   // house position on the plot (site plan)
  notes String?
  createdAt DateTime @default(now())  updatedAt DateTime @updatedAt
  project Project @relation(fields:[projectId], references:[id], onDelete: Cascade)
  rooms Room[]  components BoqComponent[]
}

model Room {                       // rectangles → SVG floor plan
  id String @id @default(cuid())
  planId String
  code String                      // "GF-LIV"
  floor Int                        // 0 = ground floor, 1 = upper floor
  name String  kind String         // living|kitchen|bedroom|bath|wc|hall|utility|storage|office|stairs
  xCm Int  yCm Int  wCm Int  hCm Int
  sortOrder Int @default(0)
  plan ArchitecturePlan @relation(fields:[planId], references:[id], onDelete: Cascade)
  @@unique([planId, code])
}

model BoqComponent {               // takeoff: "what and how much the house needs"
  id String @id @default(cuid())
  planId String
  code String                      // "BOQ-STR-002"
  houseSection HouseSection
  name String  unit String  qtyMilli Int
  materialSection String?          // MATERIALS line section slug for this component
  notes String?  sortOrder Int @default(0)
  plan ArchitecturePlan @relation(fields:[planId], references:[id], onDelete: Cascade)
  costItems CostItem[]
  @@unique([planId, code])
}

model Delivery {
  id String @id @default(cuid())
  projectId String  costItemId String  batchId String?
  deliveryNoteNo String
  kind DeliveryKind
  date String
  qtyMilli Int
  invoiceCents Int?
  createdAt DateTime @default(now())
  project Project @relation(fields:[projectId], references:[id], onDelete: Cascade)
  costItem CostItem @relation(fields:[costItemId], references:[id], onDelete: Cascade)
  batch ImportBatch? @relation(fields:[batchId], references:[id], onDelete: SetNull)
  @@unique([costItemId, deliveryNoteNo])
}

model ImportBatch {
  id String @id @default(cuid())
  projectId String  fileName String
  totalRows Int  okRows Int  failedRows Int
  errorsJson String                // JSON: ImportRowError[]
  createdAt DateTime @default(now())
  project Project @relation(fields:[projectId], references:[id], onDelete: Cascade)
  deliveries Delivery[]
}
```
(Write it in Prisma's normal one-field-per-line format; the compact form above is just for reading.)

## 3. Money formulas — `@default-project/budget-engine` (pure TS; the only dependency is `@default-project/types`, both scope:shared)

```ts
roundHalfUp(num: bigint, den: bigint): number   // away from zero; result passes Number.isSafeInteger, otherwise throws
itemPlannedCents(i) = roundHalfUp(BigInt(i.qtyMilli) * BigInt(i.unitPriceCents), 1000n)
```
**Forecast to complete (EAC) for a row:**
| status | forecast |
|---|---|
| `DONE` | `actual` |
| `CONTRACTED` (whole scope under contract) | `max(actual, committed)` |
| `PLANNED`, `PARTIAL` | `max(actual, committed + max(planned − committed, 0))` |

Derived values per row: `openCommitment = max(committed − actual, 0)` (an obligation not yet paid),
`exposure = actual + openCommitment` (costs and obligations already incurred, the CFO's question 3).

**Rollups** (line → category → project) are plain sums of rounded row values. **A total is never rounded again.**
```ts
interface Summary { approved; planned; committed; actual; openCommitments; exposure; forecast;
                    variance /* approved − forecast; negative = overrun */;
                    overrun: boolean /* forecast > approved */; spentBps; forecastVsApprovedBps }
summarizeProject(snapshot): { project: Summary; byCategory: Record<CostCategory, Summary>;
                              byLine: Record<lineId, Summary & { lineId; category; section; name }>;
                              overrunLines: Array<{lineId; name; category; section; overrunCents}> }  // sorted by overrun desc
```
- `approved` for a line is `BudgetLine.approvedCents`; for the project, the sum over lines (**the approved project budget**).
- Bps values: `roundHalfUp(x*10000, base)`, and `0` when `base = 0`.

**Profitability** — `computeProfitability(projectSummary: Summary, markupBps): Profitability`, where `Profitability = {approved; contractPrice; plannedProfit; forecastProfit; marginBps; profitErosion}` (company markup **15%** = `markupBps 1500`, a typical general contractor's margin for overhead + risk + profit; justification in GERMANY-DATA §5):
```ts
contractPrice = roundHalfUp(approved * (10000 + markupBps), 10000)   // agreed price for the client
plannedProfit = contractPrice − approved
forecastProfit = contractPrice − forecast                           // may be < 0
marginBps     = contractPrice === 0 ? 0 : roundHalfUp(forecastProfit * 10000, contractPrice)
profitErosion = plannedProfit − forecastProfit                       // = forecast − approved
```

**Schedule** — `checkSchedule(items: CostItem[], today: string): Record<itemId, ScheduleResult>`:
```ts
type MaterialStatus = 'DELIVERED'|'UNSCHEDULED'|'LATE_FOR_WORK'|'OVERDUE'|'AT_RISK'|'ON_TIME';
type ScheduleResult =
  | { kind:'MATERIAL'; status: MaterialStatus; needBy?: string; workId?: string; delayDays?: number /* LATE_FOR_WORK */; slackDays?: number /* needBy − deliveryDate */ }
  | { kind:'WORK'; status:'READY'|'BLOCKED'|'INVALID_DATES'; blockingMaterials: string[]; worstDelayDays: number };
```
- MATERIAL: `needBy = requiredForWork?.startDate`. Statuses are checked **in this order**, first match wins:
  1. `DELIVERED` (has `deliveredDate`)
  2. `UNSCHEDULED` (no `deliveryDate`)
  3. `LATE_FOR_WORK` (`deliveryDate > needBy`, `delayDays` = the difference)
  4. `OVERDUE` (`deliveryDate < today`)
  5. `AT_RISK` (`0 < slackDays < 3`)
  6. `ON_TIME`

  **A delivery on the same day as the work start (slack 0) is ON_TIME.** With no `needBy`, only `DELIVERED`/`UNSCHEDULED`/`OVERDUE`/`ON_TIME` are possible.
- WORK: `endDate < startDate` → `INVALID_DATES`; else at least one linked material is `LATE_FOR_WORK` → `BLOCKED` (`blockingMaterials` = their ids, `worstDelayDays` = max); else `READY`. SERVICE rows are not in the result.
- `today` is passed in from outside (tests do not depend on the clock). Days are calculated in UTC from `YYYY-MM-DD`.

**Cash flow (block 06 implements it; signature from block 01):** `monthlyCashflow(snapshot): { months: Array<{month:'YYYY-MM'; planned; actual; forecast; cumulativePlanned; cumulativeActual; cumulativeForecast}>; unscheduled: { planned; forecast } }`
— signature `monthlyCashflow(snapshot, today)`. Rules:
- `planned` and `forecast` of a row go to the month of `deliveryDate` (MATERIAL), or are spread **evenly by number of months** from `startDate` to `endDate` inclusive (WORK/SERVICE). The cent remainder goes to the first month, so the sum of the parts equals the original amount.
- `actual` goes to the month of `deliveredDate`, otherwise `endDate`, otherwise `startDate`, otherwise the `today` month.
- Rows with no dates at all go to `unscheduled`.
- The `months` list is continuous, from the first to the last month, including empty months.

**Portfolio (block 11 implements it):** `summarizePortfolio(snapshots[]): Omit<PortfolioAnalytics, 'cashflow'>` (type in §5). The API adds `cashflow` by summing each project's `monthlyCashflow` by month.

Engine files: `money.ts`, `rollup.ts`, `profitability.ts`, `schedule.ts` (01, fully implemented with tests),
`cashflow.ts` (signature + `throw new Error('Not implemented: block 06')` from 01, implementation by 06), `portfolio.ts` (same, by 11),
`format.ts` (01), `testing.ts` (01: factories `makeLine`, `makeItem`, `makeSnapshot`).

## 4. Budget line catalogue (sections = tab sub-sections, same in seed and wizard)

| category | section slug → name |
|---|---|
| LAND | `purchase` Land purchase · `acquisition-costs` Taxes, notary & land registry · `site-development` Utility connections & site development · `surveys` Survey & soil report |
| ARCHITECTURE | `design` Architect (HOAI) · `engineering` Structural & energy engineering · `permits` Permits & authority fees · `insurance` Construction insurance |
| MATERIALS | `concrete` Concrete & reinforcement · `masonry` Masonry · `roofing` Roof structure & roofing · `windows-doors` Windows, doors & stairs · `insulation-facade` Insulation & facade · `electrical` Electrical · `plumbing` Plumbing & sanitary · `heating` Heating & ventilation · `drywall-plaster` Drywall, plaster & screed · `flooring-tiles` Flooring & tiles · `paint` Paint & finishes · `exterior` Outdoor & landscaping |
| CONSTRUCTION | `site-setup` Site setup & logistics · `earthworks` Earthworks & foundation · `shell` Shell construction · `roof` Carpentry & roofing · `windows-install` Window, door & stair installation · `electrical-install` Electrical installation · `plumbing-install` Plumbing installation · `heating-install` Heating & ventilation installation · `plaster-screed` Plaster & screed · `drywall` Drywall · `flooring-tiling` Flooring & tiling · `painting` Painting · `facade` Facade (ETICS) · `outdoor` Outdoor works · `contingency` Contingency reserve (a line with no items) |
| MARKETING | `listings` Property portals · `paid-search` Paid search · `social` Social media ads · `website-seo` Website & SEO · `visuals` Renders, photo & virtual tours · `print-signage` Print & site signage · `events` Show house & open days · `sales-commission` Sales commission |

The house section (HouseSection) → MATERIALS section mapping is set through `BoqComponent.materialSection`.
The `windows-doors` section is called "Windows, doors & stairs" and `windows-install` is "Window, door & stair installation" (the stairs go there).

**Row code prefixes** (`BUDGET_CATALOG[i].codePrefix`). A row code is `<KIND>-<PREFIX>-NNN`, where KIND is `MAT`/`WRK`/`SRV`.
- LAND: purchase=PUR, acquisition-costs=ACQ, site-development=DEV, surveys=SUR
- ARCHITECTURE: design=DES, engineering=ENG, permits=PER, insurance=INS
- MATERIALS: concrete=CON, masonry=MAS, roofing=ROF, windows-doors=WIN, insulation-facade=INF, electrical=ELE, plumbing=PLU, heating=HEA, drywall-plaster=DRP, flooring-tiles=FLT, paint=PAI, exterior=EXT
- CONSTRUCTION: site-setup=SIT, earthworks=EAR, shell=SHL, roof=ROO, windows-install=WIN, electrical-install=ELE, plumbing-install=PLU, heating-install=HEA, plaster-screed=PLS, drywall=DRY, flooring-tiling=FLT, painting=PAI, facade=FAC, outdoor=OUT, contingency=CTG
- MARKETING: listings=LST, paid-search=SEA, social=SOC, website-seo=WEB, visuals=VIS, print-signage=PRT, events=EVT, sales-commission=COM

Examples: `MAT-WIN-001`, `WRK-WIN-001`, `SRV-DES-003`.

## 5. API (prefix `/api`, global `ValidationPipe({whitelist, transform})`)

Response = zod type from `@default-project/types`. Errors are Nest HTTP exceptions. Owner in the right-hand column.

| Method & path | Body → Response | Owner |
|---|---|---|
| `GET /projects` | → `ProjectListItem[]` = `Project & { summary: Summary; profitability: Profitability }` (no templates) | 01 |
| `POST /projects/:id/duplicate` | `{name?}` → `ProjectSnapshot`: a deep copy with remapped links (lines, rows, land, plan, rooms, BOQ, deliveries). **Used by every e2e test**, so it never touches the demo project | 01 |
| `GET /projects/:id` | → `ProjectSnapshot` | 01 |
| `POST /projects` | `CreateProjectDto` (empty project + default lines from §4 with 0 approved) → `ProjectSnapshot` | 01 |
| `PATCH /projects/:id` | `UpdateProjectDto` (name, clientName, city, status, startDate, endDate, markupBps) → `Project` | 01 |
| `POST /projects/:id/budget-lines`, `PATCH|DELETE /projects/:id/budget-lines/:lineId` | → `BudgetLine`. DELETE of a line that still has items → **409** (owner decision, as-built 01) | 01 |
| `POST /projects/:id/items`, `PATCH|DELETE /projects/:id/items/:itemId` | `CreateCostItemDto` / `UpdateCostItemDto` (partial) → `CostItem` | 01 |
| `GET /organizations`, `POST /organizations`, `PATCH /organizations/:id` | → `Organization` | 01 |
| `PATCH /projects/:id/land`, `PATCH /projects/:id/land/utilities/:type` | → `LandParcel` / `UtilityConnection` (upsert by type) | 07 |
| `PATCH /projects/:id/plan`; `POST|PATCH|DELETE /projects/:id/plan/rooms[/:roomId]`; `POST|PATCH|DELETE /projects/:id/plan/components[/:componentId]` | changing a component's `qtyMilli` **in the same transaction** updates `qtyMilli` of every linked CostItem (`boqComponentId`) | 08 |
| `GET /projects/:id/deliveries`; `POST /projects/:id/deliveries/import` `{fileName, rows: DeliveryImportRow[]}` → `ImportResult` | 10 |
| `GET /analytics/portfolio?today=YYYY-MM-DD` (optional; fallback env `DEMO_TODAY`, then `2026-10-14`, CR-11) → `PortfolioAnalytics` = `{ totals: Summary; profitability: Profitability /* sum of per-project fields; marginBps = toBps(Σ forecastProfit, Σ contractPrice), CR-11 */; projects: Array<{projectId; slug; name; city; status; summary: Summary; profitability: Profitability; byCategory: Record<CostCategory, Summary>; /* CR-11, optional: */ startDate?; endDate?; overrunLineCount?; cashflow?: CashflowMonth[]; delivery?: {deliveredRows; onTimeRows; overdueItems}}>; byCategory: Record<CostCategory, Summary>; cashflow: Array<{month; planned; actual; forecast; cumulativePlanned; cumulativeActual; cumulativeForecast}> }` | 11 |
| `POST /projects/wizard` `WizardInput` → `ProjectSnapshot` (clones the template, scales quantities by area: only continuous units `m3 m2 m t kg h` of MATERIALS/CONSTRUCTION rows and BOQ, counted units stay (CR-12), applies the step overrides) | 12 |
| `GET /projects/wizard/template` → `ProjectSnapshot` of `template-efh-144` (404 when the seed has not run). Two segments after `/projects`, so no clash with `GET /projects/:id` (CR-12) | 12 |

`WizardInput` = `{ name; clientName; city; startDate; markupBps; land: { address; postalCode; municipality; state; areaM2; landValuePerM2Cents; grzBps; gfzBps; maxStoreys; soilClass; groundwaterDepthCm?; utilities: Array<{type: UtilityType; status: UtilityStatus}> }; house: { livingAreaM2; storeys: 1|2; energyStandard: 'EH55'|'EH40'; heating: 'HEAT_PUMP'|'GAS_HYBRID'; wallType: 'SAND_LIME_ETICS'|'MONOLITHIC_BRICK' }; approvedByCategory?: Record<CostCategory, cents> }` (**optional**, as-built 01: omitted → the template's approved amounts). `ProjectWizardModule` is registered before `ProjectsModule`, so the `/projects/wizard/*` routes win over `/projects/:id`.
| `GET /search?q=` → `SearchResult[]` (`{type: project|item|organization|line; id; projectId?; title; subtitle; href}`) | 13 |
| `GET /health` (exists) | | — |

Modules for 07–13 are **created as stubs by 01** (`@Module({})` + an empty controller), already registered in `app.module.ts`. Blocks fill in their own folder.

**`ProjectSnapshot`** (zod, in `snapshot.ts`): `{ project: Project; budgetLines: BudgetLine[]; items: CostItem[]; organizations: Organization[] /* referenced */; land: (LandParcel & {utilities: UtilityConnection[]}) | null; plan: (ArchitecturePlan & {rooms: Room[]; components: BoqComponent[]}) | null; deliveries: Delivery[] }`.
`planned` is **not** stored anywhere; it is computed by the engine.

**Delivery import (10):** CSV columns `itemCode,deliveryNoteNo,kind,date,quantity,invoiceAmountEur` (`kind` = EXPECTED|DELIVERED; quantity and amount are decimal strings with a dot).
The client parses the CSV (papaparse) and sends JSON. The server validates every row and applies **the valid rows** (partial import) in one transaction, idempotently: `upsert` by (`costItemId`,`deliveryNoteNo`).
Effects: EXPECTED → `item.deliveryDate = date`; DELIVERED → `item.deliveredDate = max(date)` and `item.actualCents = Σ invoiceCents of the item's DELIVERED deliveries` (recomputed, not incremented).
`ImportResult = { batchId; totalRows; okRows; failedRows; errors: Array<{row:number; field?:string; message:string}>; updatedItemIds: string[] }`.
Two rows in one file with the same (`itemCode`,`deliveryNoteNo`): the second one is an error "duplicate deliveryNoteNo". `invoiceAmountEur` may be empty only when `kind=EXPECTED`. An empty file or wrong headers → 400, nothing is written. Assumption: partial import (good rows are written, bad rows are reported with their row number); recorded in SOLUTION.md.

## 6. Web: data and state (implemented by 02, used by everyone)

- `apps/web/src/lib/api-client.ts`: `apiGet/apiPost/apiPatch/apiDelete` with the timeout and error handling.
- Query keys (`apps/web/src/lib/query-keys.ts`): `['projects']`, `['project', id]`, `['organizations']`, `['deliveries', projectId]`, `['analytics','portfolio']`, `['search', q]`. A block-private key lives in its own feature folder (e.g. `['project-wizard','template']` in `features/project-wizard/`, CR-12); `query-keys.ts` lists only the shared ones.
- `useProjectSnapshot(id, select?)` → cached `ProjectCache` = snapshot + `itemsById`, `itemIdsByLineId`, `linesById`, `orgsById`. `refetchOnWindowFocus:false`, `staleTime: 30s`.
- **Re-renders:** a table renders `useItemIds(projectId, lineId)` (an array of ids that keeps its identity through structural sharing). A row subscribes to `useItem(projectId, itemId)`. Rows are `React.memo`. Summaries use `useProjectSummary(projectId)` (`select` + memoized engine call).
- **Edits:** `useEditItem(projectId)` → `(itemId, patch) => void`: (1) `queryClient.cancelQueries(['project',id])`; (2) `setQueryData` replaces **only** that row (other rows keep their identity); (3) `autosaveQueue.enqueue('item:'+itemId, patch)`.
- `autosaveQueue.enqueue<T>(key: string, patch: object, opts: { send: (merged) => Promise<T>; onSuccess: (res: T) => void; rollback: () => void })` (`apps/web/src/lib/autosave-queue.ts`, a module singleton, not tied to components). The latest `opts` for a key wins. Behaviour: merges patches for a key and sends them 400 ms after the last change; `flush()` on blur, on route change (in the layout), and on `beforeunload`; saves for one key run strictly one after another; if a save fails, the row's snapshot is rolled back and a toast is shown; if it succeeds, the server row is written into the cache **only if there are no newer pending changes for that key**. After any successful save, the hooks call `invalidateQueries(['projects'])` and `invalidateQueries(['analytics'])` (inactive queries are not refetched, which is cheap). Hooks with the same semantics: `useEditBudgetLine`, `useEditProject`, `useEditOrganization`, `useCreateItem`, `useDeleteItem`.
- **"Today"** for every schedule check: `useToday()` returns the build constant `__DEMO_TODAY__`. `vite.config.mts` sets it with `define: { __DEMO_TODAY__: JSON.stringify(process.env.DEMO_TODAY ?? '2026-10-14') }`, which works in dev, preview and e2e, so the demo statuses don't "drift" after the seed date. `DEMO_TODAY=today` switches to the current date. Tests pass the date explicitly.
- Where shared web exports live (02):
  - `features/project/budget-health-panel.tsx` → `BudgetHealthPanel`
  - `features/project/use-schedule.ts` → `useSchedule(projectId)` (= `checkSchedule(items, useToday())`, memoized)
  - `features/project/use-today.ts` → `useToday()`
  - `lib/ui-store.ts` → `useUiStore`
  - `features/organizations/use-organizations.ts` → `useOrganizations()` (`['organizations']`, every organisation, for the pickers)
  - `features/organizations/organization-modal.tsx` → `OrganizationModal`
  - `ui/editable-table/` → `EditableTable` + cells
- `?highlight=<rowId>` is handled by EditableTable (scroll + flash). `?org=<orgId>` is handled by the `ProjectPage` layout (opens OrganizationModal on any tab).
- Engine test factories: `makeLine`, `makeItem`, `makeOrg`, `makeSnapshot` are exported from the `@default-project/budget-engine` index.
- Selected sub-tabs live in the URL (`/projects/:id/materials/electrical`). Remembering the last sub-tab per tab: zustand `useUiStore` (`lastSection[tab]`, `sidebarCollapsed`; persisted to localStorage, UI state only).

## 7. Ownership of files (who writes what)

| Block | Owns (writes) |
|---|---|
| 01 | `apps/api/prisma/**` (except `seed/`), `apps/api/prisma.config.ts`, `apps/api/src/{projects,budget-lines,cost-items,organizations}/**`, stub modules `apps/api/src/{land,architecture,deliveries,analytics,project-wizard,search}/*.module.ts|*.controller.ts` (empty), `apps/api/src/app/app.module.ts`, `libs/shared/types/**`, `libs/shared/budget-engine/**` (except the body of `cashflow.ts`, `portfolio.ts`), `package.json`/lock, `tsconfig.base.json` (generator), `apps/web-e2e/playwright.config.ts` (webServer: api 3454 + `web:preview` on **4300**) |
| 02 | `apps/web/src/{app,ui,lib}/**`, `apps/web/src/features/project/**`, `apps/web/src/features/projects-list/**`, `apps/web/src/features/organizations/**` (modal), `apps/web/src/styles.css`, `apps/web/src/main.tsx`, `apps/web/index.html`, `apps/web/.env*`, **the whole `apps/web/vite.config.mts`** (incl. `preview.port = PREVIEW_PORT ?? 4300` + the `/api` proxy on preview, `define __DEMO_TODAY__`), the existing `app.spec.tsx` and `apps/web-e2e/src/example.spec.ts` (rewrite deliberately) |
| 03 | `apps/api/prisma/seed.ts`, `apps/api/prisma/seed/**`, `apps/api/src/seed-data/**`, `apps/web-e2e/fixtures/deliveries-*.csv` |
| 04 | `apps/web/src/features/materials/**`, `apps/web-e2e/src/materials.spec.ts` |
| 05 | `apps/web/src/features/construction/**`, `apps/web-e2e/src/construction.spec.ts` |
| 06 | `apps/web/src/features/profitability/**`, body of `libs/shared/budget-engine/src/lib/cashflow.ts` + `cashflow.spec.ts`, `apps/web-e2e/src/profitability.spec.ts` |
| 07 | `apps/api/src/land/**`, `apps/web/src/features/land/**`, `apps/web-e2e/src/land.spec.ts` |
| 08 | `apps/api/src/architecture/**`, `apps/web/src/features/architecture/**`, `apps/web-e2e/src/architecture.spec.ts` |
| 09 | `apps/web/src/features/marketing/**`, `apps/web-e2e/src/marketing.spec.ts` |
| 10 | `apps/api/src/deliveries/**`, `apps/web/src/features/delivery-tracking/**`, `apps/web-e2e/src/delivery-tracking.spec.ts` |
| 11 | `apps/api/src/analytics/**`, `apps/web/src/features/analytics/**`, body of `budget-engine/src/lib/portfolio.ts` + spec, `apps/web-e2e/src/analytics.spec.ts` |
| 12 | `apps/api/src/project-wizard/**`, `apps/web/src/features/project-wizard/**`, `apps/web-e2e/src/wizard.spec.ts` |
| 13 | `apps/api/src/search/**`, `apps/web/src/features/search/**`, `apps/web-e2e/src/search.spec.ts` |
| 00 | everything frozen after `w0-frozen` (PROTOCOL §4), `README.md`, `SOLUTION.md`, `docs/**`, `howItWorks/**`, `apps/web-e2e/src/cfo-journey.spec.ts` |

**Placeholders from 02** (frozen route points): every feature folder from 04–13 contains `<feature>-page.tsx` with `export function <Feature>Page()` that renders `<ComingSoon title=.../>`. The owning block **replaces the body** of that file (same name and export), and the routes don't change.
Route ↔ component table (`routes.tsx`):

| Route | Component (file) |
|---|---|
| `/` | redirect → `/projects` |
| `/projects` | `ProjectsListPage` (`features/projects-list/projects-list-page.tsx`) |
| `/projects/new` | `ProjectWizardPage` (`features/project-wizard/project-wizard-page.tsx`) |
| `/projects/:projectId` | `ProjectPage` (layout with tabs) → index redirect to `land` |
| `…/land` | `LandPage` |
| `…/architecture` | `ArchitecturePage` |
| `…/materials/:section?` | `MaterialsPage` |
| `…/construction/:section?` | `ConstructionPage` |
| `…/marketing/:section?` | `MarketingPage` |
| `…/profitability` | `ProfitabilityPage` |
| `/deliveries` | `DeliveryTrackingPage` |
| `/analytics` | `AnalyticsPage` |
| `/search` | `SearchPage` (`features/search/search-page.tsx`); in the header: `GlobalSearch` (`features/search/global-search.tsx`, a placeholder input from 02) |

## 8. Dependencies (installed by block 01 only, exact versions)

`npm i -E recharts@3.10.1 react-is@19.3.0 lucide-react@1.57.0 papaparse@5.7.0 && npm i -DE @types/papaparse@5.5.2`
Tailwind 4.2.4 and `@tailwindcss/vite` are already in package.json (block 02 wires them up). Seed runner (as-built 01): `ts-node -P tsconfig.app.json -r ./prisma/register-paths.cjs prisma/seed.ts` in `prisma.config.ts` → `migrations.seed`; it resolves `@default-project/*`. Types also export the input schemas for 07/08/10 and the zod `Summary`/`Profitability`/`CashflowMonth` (see 01 HANDOFF).
