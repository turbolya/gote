// Turn docs/MANUAL-TESTS.md into a CSV Testiny can import.
//
// The manual cases are written in the repo, next to the code they describe, and
// Testiny is a consumer — that way a case can be reviewed in a pull request
// alongside the change that motivated it, and a case cannot quietly diverge from
// the app while nobody is looking at the test-management tool.
//
//   node scripts/testiny-export.js           write testiny-cases.csv
//   node scripts/testiny-export.js --check    validate only (runs in npm test)
//
// The parser is deliberately strict. A loose one would happily emit a case with
// an empty Expected column, which in Testiny reads as a step somebody forgot to
// finish rather than as a broken export — the failure would land on whoever runs
// the test, weeks later, instead of here.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SOURCE = path.join(root, 'docs', 'MANUAL-TESTS.md');
const OUT = path.join(root, 'testiny-cases.csv');

const PRIORITIES = ['High', 'Medium', 'Low'];

function parse(markdown) {
  const lines = markdown.split('\n');
  const cases = [];
  const errors = [];
  let folder = null;
  let current = null;

  const finish = () => {
    if (!current) return;
    const where = `${current.id} ("${current.title}")`;
    if (!current.priority) errors.push(`${where}: no **Priority:** line`);
    else if (!PRIORITIES.includes(current.priority)) {
      errors.push(`${where}: priority "${current.priority}" is not one of ${PRIORITIES.join('/')}`);
    }
    if (!current.precondition) errors.push(`${where}: no **Preconditions:** line`);
    if (!current.steps.length) errors.push(`${where}: no numbered steps`);
    if (!current.expected) errors.push(`${where}: no **Expected:** line`);
    cases.push(current);
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    // A section heading becomes the Testiny folder. "Guided tour — exiting"
    // turns into the path "Guided tour/exiting", so the suite arrives with the
    // same shape it has here rather than as one flat list of 32.
    const section = /^## (.+)$/.exec(line);
    if (section) {
      finish();
      folder = section[1].split(/\s+—\s+/).map((s) => s.trim()).join('/');
      continue;
    }

    const heading = /^### ([A-Z]+-\d+) (.+)$/.exec(line);
    if (heading) {
      finish();
      if (!folder) errors.push(`${heading[1]}: sits above any "## " section, so it has no folder`);
      current = {
        id: heading[1],
        title: heading[2].trim(),
        folder,
        priority: null,
        precondition: null,
        steps: [],
        expected: null,
      };
      continue;
    }

    if (!current) continue;

    const field = /^\*\*(Priority|Preconditions|Expected):\*\*\s*(.*)$/.exec(line);
    if (field) {
      const value = field[2].trim();
      if (field[1] === 'Priority') current.priority = value;
      if (field[1] === 'Preconditions') current.precondition = value;
      if (field[1] === 'Expected') current.expected = value;
      continue;
    }

    const step = /^(\d+)\.\s+(.+)$/.exec(line);
    if (step) {
      const n = Number(step[1]);
      // Contiguous numbering, because a skipped number in the source is nearly
      // always a case that was edited down and half-renumbered.
      if (n !== current.steps.length + 1) {
        errors.push(`${current.id}: step numbered ${n} where ${current.steps.length + 1} was expected`);
      }
      current.steps.push(step[2].trim());
      continue;
    }

    // A continuation line for whichever field was last opened.
    if (line.trim() && current.expected !== null && !line.startsWith('**')) {
      current.expected += ' ' + line.trim();
    }
  }
  finish();

  const ids = cases.map((c) => c.id);
  for (const id of ids) {
    if (ids.indexOf(id) !== ids.lastIndexOf(id)) errors.push(`${id}: duplicate id`);
  }
  const titles = cases.map((c) => c.title);
  for (const t of titles) {
    // Re-importing matches on Title, so two cases sharing one would collapse
    // into a single Testiny case and silently lose the other.
    if (titles.indexOf(t) !== titles.lastIndexOf(t)) errors.push(`duplicate title: "${t}"`);
  }
  if (!cases.length) errors.push('no cases found — has the heading format changed?');

  return { cases, errors: [...new Set(errors)] };
}

// Minimal RFC 4180: quote everything, double any embedded quote. Testiny's
// importer reads multi-line quoted fields, which is what keeps the steps
// readable as a list rather than one run-on line.
const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;

function toCsv(cases) {
  const header = ['Folder', 'Title', 'Priority', 'Precondition', 'Steps', 'Expected Result', 'Reference'];
  const rows = cases.map((c) =>
    [
      c.folder,
      c.title,
      c.priority,
      c.precondition,
      c.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
      c.expected,
      c.id, // kept so a Testiny case can be traced back to this file
    ].map(cell).join(',')
  );
  return [header.map(cell).join(','), ...rows].join('\n') + '\n';
}

const { cases, errors } = parse(fs.readFileSync(SOURCE, 'utf8'));

if (errors.length) {
  console.error(`\n${path.relative(root, SOURCE)} — ${errors.length} problem(s):\n`);
  for (const e of errors) console.error('  ' + e);
  console.error('\nSee the "Format" section of that file for the shape each case must take.\n');
  process.exit(1);
}

const byFolder = cases.reduce((acc, c) => ({ ...acc, [c.folder]: (acc[c.folder] || 0) + 1 }), {});

if (process.argv.includes('--check')) {
  console.log(`\nManual test cases: ${cases.length} valid`);
  for (const [f, n] of Object.entries(byFolder)) console.log(`  ${n}  ${f}`);
  console.log('');
} else {
  fs.writeFileSync(OUT, toCsv(cases));
  console.log(`\nWrote ${path.relative(root, OUT)} — ${cases.length} cases`);
  for (const [f, n] of Object.entries(byFolder)) console.log(`  ${n}  ${f}`);
  console.log('\nImport it in Testiny: project → Import → test cases → upload.\n');
}
