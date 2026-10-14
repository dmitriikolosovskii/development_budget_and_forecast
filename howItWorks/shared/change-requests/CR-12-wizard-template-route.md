# CR-12-wizard-template-route
- Author: block 12 · Date: 2026-10-14
- Status: applied 11:47 (docs only): items 1 and 3 in CONTRACTS §5; item 2 resolved without touching `query-keys.ts` (owned by 02): the private key stays in your feature folder, rule added to §6. Drop the `TODO CR-12`.
- Affected: registry (CONTRACTS §5 API table, §6 query keys)
- Blocks affected: none (only 12 calls it)

## What to change
1. CONTRACTS §5, add the row: `GET /projects/wizard/template` → `ProjectSnapshot` of `template-efh-144` (404 when the seed has not run) | 12.
2. CONTRACTS §6 / `apps/web/src/lib/query-keys.ts`, add the key `['project-wizard','template']`.
3. Document the scaling deviation in CONTRACTS §5 `POST /projects/wizard`. Only continuous units (m3, m2, m, t, kg, h) of MATERIALS/CONSTRUCTION rows and BOQ are scaled by the area factor (03's derive rule). Counted units stay as they are.

## Why it can't be done inside the block
The wizard's live estimate (`estimateBudget(input, template)`, BLOCK step 4) needs the template rows on the client. `GET /projects` hides templates, and the client doesn't know the template id. The route itself lives in block 12's controller. Only the registry text and the shared query-key list are frozen.

## Local workaround in the meantime
`apps/web/src/features/project-wizard/use-wizard-template.ts` uses a local key `['project-wizard','template']` marked `// TODO CR-12`.
