// Prints one line per Playwright spec from a JSON report: "passed|failed|skipped<TAB>suite > ... > title".
// Usage: node pw-report.js <report.json>. Shared by ac-ledger.sh and e2e.sh.
const r = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
const walk = (s, path) => {
  const here = s.title ? [...path, s.title] : path;
  for (const sp of s.specs || []) {
    const st = (sp.tests || []).map((t) => t.status);
    const v = st.length && st.every((x) => x === 'expected' || x === 'flaky') ? 'passed'
      : st.some((x) => x === 'unexpected') ? 'failed' : 'skipped';
    console.log(v + '\t' + [...here, sp.title].join(' > '));
  }
  for (const c of s.suites || []) walk(c, here);
};
for (const s of r.suites || []) walk(s, []);
