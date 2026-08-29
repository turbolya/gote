// Turn the manual-test markdown into CSVs Testiny can import.
//
// The cases are written in the repo, next to the code they describe, and Testiny
// is a consumer — that way a case can be reviewed in a pull request alongside the
// change that motivated it, and a case cannot quietly diverge from the app while
// nobody is looking at the test-management tool. The CSVs are generated and
// gitignored: there is exactly one copy of a case, and it is the markdown.
//
//   node scripts/testiny-export.js           write testiny-cases.csv
//   node scripts/testiny-export.js --check    validate only (runs in npm test)
//
// One source, deliberately. There were three copies of these cases as recently
// as this week — this markdown, a CSV maintained by hand beside it, and a second
// markdown file written later for the guided tour — and they had drifted exactly
// as you would expect: 41 of 84 cases carried a different title in the CSV than
// in the markdown, and the second file had grown a duplicate of a case the first
// already covered. Copies of a case do not stay in step; there is no mechanism
// by which they could.
//
// The parser is deliberately strict. A loose one would happily emit a case
// with an empty Expected column, which in Testiny reads as a step somebody forgot
// to finish rather than as a broken export — the failure would land on whoever
// runs the test, weeks later, instead of here.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const PRIORITIES = ['High', 'Medium', 'Low'];
// The plan's cases carry a priority only when it is not the ordinary one, so the
// checklist is not 84 lines longer for nothing.
const DEFAULT_PRIORITY = 'Medium';

// The release checklist. Its cases are tick-box list items, because the document
// is walked top to bottom by a human before a submission:
//
//   ## 4. Stats, Lexicon & streak                  <- the Testiny folder
//
//   - [ ] **TC-4.1 Statistics screen.** Open Statistics after a few rounds.
//     - *Preconditions:* a couple of rounds played
//     - *Priority:* High
//     - *Expected:* every tile is populated…
//     - *Note:* anything else indented under the case joins the expectation.
//
// The prose after the bold title is the case's steps; it may wrap. Preconditions
// and Priority are optional (priority defaults to Medium). Everything else
// indented under the case — *Expected:*, *Also expected —*, *Note:* — is folded
// into the expectation in the order written, because in Testiny they are all
// "what should have happened" and splitting them across columns would lose the
// sentence they were written as.
function parsePlan(markdown) {
  const lines = markdown.split('\n');
  const cases = [];
  const errors = [];
  let folder = null;
  let current = null;
  let openField = null; // which multi-line field a continuation line belongs to
  let fenced = false;   // inside ``` — the Format section shows a worked example

  const finish = () => {
    if (!current) return;
    const where = `${current.id} ("${current.title}")`;
    if (!PRIORITIES.includes(current.priority)) {
      errors.push(`${where}: priority "${current.priority}" is not one of ${PRIORITIES.join('/')}`);
    }
    if (!current.prose && !current.steps.length) errors.push(`${where}: nothing to do — no steps after the title`);
    if (!current.expected) errors.push(`${where}: no "- *Expected:*" line`);
    cases.push(current);
    current = null;
    openField = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;

    // Only "## " headings name a folder. The "# Part n" dividers above them are
    // for the reader, and several parts carry no cases of their own.
    const section = /^## (.+)$/.exec(line);
    if (section) {
      finish();
      folder = section[1].trim();
      continue;
    }
    if (/^# /.test(line)) {
      finish();
      continue;
    }

    const heading = /^- \[ \] \*\*(TC-\d+\.\d+[a-z]?)\s+(.+?)\*\*\s*(.*)$/.exec(line);
    if (heading) {
      finish();
      if (!folder) errors.push(`${heading[1]}: sits above any "## " section, so it has no folder`);
      current = {
        id: heading[1],
        title: heading[2].trim().replace(/\.$/, ''),
        folder,
        priority: DEFAULT_PRIORITY,
        precondition: '',
        prose: heading[3].trim(),
        steps: [],
        expected: '',
      };
      openField = 'prose';
      continue;
    }

    if (!current) continue;

    // A numbered sub-item is a step of its own, for cases that are a sequence
    // rather than a single instruction.
    const step = /^\s+(\d+)\.\s+(.+)$/.exec(line);
    if (step) {
      const n = Number(step[1]);
      // Contiguous numbering: a skipped number is nearly always a case that was
      // edited down and half-renumbered.
      if (n !== current.steps.length + 1) {
        errors.push(`${current.id}: step numbered ${n} where ${current.steps.length + 1} was expected`);
      }
      current.steps.push(step[2].trim());
      openField = 'step';
      continue;
    }

    const field = /^\s*- \*(Preconditions|Priority|Expected):\*\s*(.*)$/.exec(line);
    if (field) {
      const value = field[2].trim();
      if (field[1] === 'Priority') {
        current.priority = value;
        openField = null;
      } else if (field[1] === 'Preconditions') {
        current.precondition = value;
        openField = 'precondition';
      } else {
        current.expected = current.expected ? `${current.expected} ${value}` : value;
        openField = 'expected';
      }
      continue;
    }

    // Any other italic sub-bullet — "*Also expected —*", "*Note:*" — is more of
    // the expectation, kept with its own lead-in so it still reads as written.
    const aside = /^\s*- (\*.+)$/.exec(line);
    if (aside) {
      current.expected = current.expected ? `${current.expected} ${aside[1].trim()}` : aside[1].trim();
      openField = 'expected';
      continue;
    }

    if (!line.trim()) {
      openField = null;
      continue;
    }
    // A wrapped line continues whichever field was last opened.
    if (openField === 'prose') current.prose += ' ' + line.trim();
    else if (openField === 'step') current.steps[current.steps.length - 1] += ' ' + line.trim();
    else if (openField === 'precondition') current.precondition += ' ' + line.trim();
    else if (openField === 'expected') current.expected += ' ' + line.trim();
  }
  finish();

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
      [c.prose, ...c.steps.map((s, i) => `${i + 1}. ${s}`)].filter(Boolean).join('\n'),
      c.expected,
      c.id, // kept so a Testiny case can be traced back to this file
    ].map(cell).join(',')
  );
  return [header.map(cell).join(','), ...rows].join('\n') + '\n';
}

// Checks that hold whatever the source's shape is: an id or a title used twice
// is a case that will collide with itself on import, and an empty source is a
// parser that has stopped recognising the file rather than a file with no cases.
function validate({ cases, errors }) {
  const found = [...errors];
  const seen = (key, what) => {
    const values = cases.map((c) => c[key]);
    for (const v of values) {
      // Re-importing detects on folder & title, so two cases sharing one are a
      // coin toss over which the tester is looking at.
      if (values.indexOf(v) !== values.lastIndexOf(v)) found.push(`duplicate ${what}: "${v}"`);
    }
  };
  seen('id', 'id');
  seen('title', 'title');
  if (!cases.length) found.push('no cases found — has the format changed?');
  return { cases, errors: [...new Set(found)] };
}

const SOURCE = path.join(root, 'docs', 'MANUAL-TESTS.md');
const OUT = path.join(root, 'testiny-cases.csv');

const rel = path.relative(root, SOURCE);
const { cases, errors } = validate(parsePlan(fs.readFileSync(SOURCE, 'utf8')));

if (errors.length) {
  console.error(`\n${rel} — ${errors.length} problem(s):\n`);
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
