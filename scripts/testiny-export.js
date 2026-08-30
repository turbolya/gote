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
    // Trim what the wrapping logic assembled. A case whose prose starts on the
    // line after its title picks up a leading space, which is invisible here,
    // survives into the CSV, and — because Testiny trims on store — makes the
    // push report that case as changed on every single run, for ever.
    current.prose = current.prose.trim();
    current.precondition = current.precondition.trim();
    current.expected = current.expected.trim();
    current.steps = current.steps.map((x) => x.trim());
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

// --- pushing to Testiny ------------------------------------------------------
//
// The CSV importer can only ever CREATE. It detects an existing case by folder
// and title, and all that detection decides is whether a match is skipped or
// duplicated — so an edit here has to be retyped in the web UI, and the two
// copies drift. That is how 41 of 84 titles came to disagree.
//
// The API has what the importer lacks: every case carries its reference in a
// custom field (`cf__testcaseid`), which survives a rename, and PUT can change a
// case in place. So this pushes the markdown over the top of Testiny — creating
// what is missing, updating what differs, and moving what has changed folder.
//
//   TESTINY_API_KEY=… node scripts/testiny-export.js --push           plan only
//   TESTINY_API_KEY=… node scripts/testiny-export.js --push --write   do it
//
// Dry by default, and deliberately: --push prints what it would do and changes
// nothing. Nothing here deletes, either. A case in Testiny that the markdown no
// longer has is reported and left alone — it may be a rename this run cannot
// see, and an automated delete of someone's test case is not a thing to be
// clever about.

const API = 'https://app.testiny.io/api/v1';
const PROJECT_KEY = 'GOTE';
// Testiny stores priority as a number; the names are ours.
const PRIORITY_NUMBER = { High: 1, Medium: 2, Low: 3 };

// Testiny's text fields are not text. They hold a Slate document —
// {"t":"slate","v":1,"c":[{"t":"p","children":[{"text":"…"}]}]} — so a plain
// string written into one would be stored as a broken document, and a plain
// string COMPARED with one differs every single time, which would report all
// 105 cases as needing an update on every run. Both directions have to go
// through these two.
const slate = (text) => JSON.stringify({
  t: 'slate',
  v: 1,
  c: String(text || '')
    .split('\n')
    .map((line) => ({ t: 'p', children: [{ text: line }] })),
});

// Pull the words back out of one, for comparison. Walks the tree rather than
// assuming paragraphs: a case edited in the web UI can hold tables (the STEPS
// template writes one), lists, or marked-up runs.
function plain(value) {
  if (!value) return '';
  let doc;
  try {
    doc = JSON.parse(value);
  } catch {
    return String(value).trim(); // already plain, e.g. a field never touched by the editor
  }
  const lines = [];
  const walk = (node, into) => {
    if (typeof node.text === 'string') into.push(node.text);
    for (const child of node.children || node.c || []) {
      if (child.t === 'p' || child.t === 'tr' || child.t === 'td') {
        const buf = [];
        walk(child, buf);
        const joined = buf.join('').trim();
        if (joined) lines.push(joined);
      } else {
        walk(child, into);
      }
    }
  };
  walk(doc, []);
  return lines.join('\n').trim();
}
// The fields this file owns. Anything else on a Testiny case — its status, its
// automation link, whatever someone set in the UI — is left alone.
const OWNED = ['title', 'precondition_text', 'steps_text', 'expected_result_text', 'priority'];

async function api(key, method, route, body) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: { 'X-Api-Key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${route} → ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// What the markdown says a case should look like, as plain text. Kept plain so
// it can be compared with what plain() pulls back out of Testiny; slate() wraps
// it only on the way out.
function wanted(c) {
  return {
    title: c.title,
    precondition_text: c.precondition || '',
    steps_text: [c.prose, ...c.steps.map((s, i) => `${i + 1}. ${s}`)].filter(Boolean).join('\n'),
    expected_result_text: c.expected,
    priority: PRIORITY_NUMBER[c.priority],
  };
}

// …and the same thing as Testiny wants it written. Everything is normalised to
// the TEXT template: our source is steps-plus-one-expectation, which is exactly
// what TEXT holds, whereas the STEPS template is a table wanting an expectation
// per row — the 19 August import faked that by putting the whole expectation in
// the first row. One template is also one code path.
function payload(c) {
  const w = wanted(c);
  return {
    title: w.title,
    template: 'TEXT',
    precondition_text: slate(w.precondition_text),
    steps_text: slate(w.steps_text),
    expected_result_text: slate(w.expected_result_text),
    content_text: null, // what the STEPS template used; cleared on the way to TEXT
    priority: w.priority,
    cf__testcaseid: c.id,
  };
}

async function push(cases, { write }) {
  const key = process.env.TESTINY_API_KEY;
  if (!key) {
    console.error('\nTESTINY_API_KEY is not set. The key is in the launch handbook,');
    console.error('deliberately not in this repo.\n');
    process.exit(1);
  }

  const projects = await api(key, 'GET', '/project');
  const project = projects.data.find((p) => p.project_key === PROJECT_KEY);
  if (!project) throw new Error(`no project with key ${PROJECT_KEY}`);

  // Two reads, deliberately. The plain list is the authoritative set of cases;
  // the joined one only supplies the folder each is in. Using the join alone
  // loses any case that is in NO folder — which is a state this very script can
  // produce, if a create succeeds and the mapping call after it fails — and a
  // case missing from the read is a case the next run creates a second time.
  const remote = await api(key, 'GET', `/testcase?projectId=${project.id}&limit=2000`);
  const joined = await api(key, 'POST', '/testcase/find?limit=2000', {
    filter: { project_id: project.id },
    map: { entities: ['testcase', 'testcase_folder'] },
  });
  const inFolder = new Map(
    joined.data.map((r) => [r.id, (r.testcase_folder_testcase_values || {}).testcase_folder_id || null])
  );

  const folders = await api(key, 'GET', `/testcase-folder?projectId=${project.id}&limit=500`);
  const folderId = new Map(folders.data.map((f) => [f.title, f.id]));

  const byRef = new Map();
  const byTitle = new Map();
  for (const r of remote.data) {
    r.folder_id = inFolder.get(r.id) || null;
    if (r.cf__testcaseid) byRef.set(r.cf__testcaseid, r);
    // Cases imported before the Reference column was mapped have no id at all;
    // their title is the only handle on them, and only until it changes.
    if (!byTitle.has(r.title)) byTitle.set(r.title, r);
  }

  const plan = { folders: [], create: [], update: [], move: [], orphan: [] };
  const matched = new Set();

  for (const name of new Set(cases.map((c) => c.folder))) {
    if (!folderId.has(name)) plan.folders.push(name);
  }

  for (const c of cases) {
    const want = wanted(c);
    const found = byRef.get(c.id) || byTitle.get(c.title);
    if (!found) {
      plan.create.push({ case: c, want });
      continue;
    }
    matched.add(found.id);
    const changed = OWNED.filter((f) => {
      if (f === 'priority') return found[f] !== want[f];
      if (f === 'title') return (found[f] || '') !== want[f];
      // The STEPS template keeps everything in content_text, so a case still on
      // it reads as empty here — which is a real difference, not a false one.
      return plain(found[f] || found.content_text) !== want[f];
    });
    if (found.template !== 'TEXT') changed.push(`template ${found.template}→TEXT`);
    // A case matched by title but carrying no reference gets stamped with one,
    // so the next run matches on the id and a rename stops being a new case.
    if (!found.cf__testcaseid) changed.push('cf__testcaseid');
    if (changed.length) plan.update.push({ case: c, remote: found, want, changed });
    const target = folderId.get(c.folder);
    if (target && found.folder_id !== target) {
      plan.move.push({ case: c, remote: found, to: c.folder });
    } else if (!target) {
      plan.move.push({ case: c, remote: found, to: c.folder, pending: true });
    }
  }
  for (const r of remote.data) {
    if (!matched.has(r.id)) plan.orphan.push(r);
  }

  const n = (a) => String(a.length).padStart(3);
  console.log(`\nTestiny project ${project.project_key} (id ${project.id}) — ${remote.data.length} cases there, ${cases.length} here\n`);
  console.log(`${n(plan.folders)} folders to create`);
  for (const f of plan.folders) console.log(`      + ${f}`);
  console.log(`${n(plan.create)} cases to create`);
  for (const c of plan.create) console.log(`      + ${c.case.id.padEnd(9)} [${c.case.folder}] ${c.case.title}`);
  console.log(`${n(plan.update)} cases to update`);
  for (const u of plan.update) console.log(`      ~ ${u.case.id.padEnd(9)} ${u.case.title}\n          ${u.changed.join(', ')}`);
  console.log(`${n(plan.move)} cases to move`);
  for (const m of plan.move) console.log(`      → ${m.case.id.padEnd(9)} ${m.case.title} → ${m.to}`);
  console.log(`${n(plan.orphan)} in Testiny but not here (left alone)`);
  for (const o of plan.orphan) console.log(`      ? id=${o.id} "${o.title}"`);

  if (!write) {
    console.log('\nDry run — nothing was changed. Add --write to apply.\n');
    return;
  }

  for (const name of plan.folders) {
    const made = await api(key, 'POST', '/testcase-folder', {
      project_id: project.id, title: name, testcase_folder_parent_id: 0,
    });
    folderId.set(name, made.id);
    console.log(`  created folder ${name}`);
  }
  for (const { case: c } of plan.create) {
    const made = await api(key, 'POST', '/testcase', { ...payload(c), project_id: project.id });
    await api(key, 'POST', '/testcase-folder/mapping/bulk/testcase?op=add_or_update',
      [{ ids: { testcase_folder_id: folderId.get(c.folder), testcase_id: made.id } }]);
    console.log(`  created ${c.id} ${c.title}`);
  }
  for (const { case: c, remote: r } of plan.update) {
    // _etag is Testiny's optimistic lock: send the one we read, and the write is
    // refused if someone changed the case in the UI in the meantime.
    await api(key, 'PUT', `/testcase/${r.id}`, { ...payload(c), _etag: r._etag });
    console.log(`  updated ${c.id} ${c.title}`);
  }
  for (const { case: c, remote: r, to } of plan.move) {
    // The ids go in an `ids` record — the mapping table's own shape, not a flat
    // object. A flat one is a 400: "Expected record object at Mappings.0.ids".
    //
    // And a move is not an upsert. `add_or_update` inserts, so on a case that
    // already sits in a folder it fails with "Key (testcase_id) already exists";
    // the row has to be identified by the pair it currently is, and given the
    // new folder in newIds. Only a case in no folder at all is an `add`.
    const target = folderId.get(to);
    await (r.folder_id
      ? api(key, 'POST', '/testcase-folder/mapping/bulk/testcase?op=update',
          [{ ids: { testcase_id: r.id, testcase_folder_id: r.folder_id }, newIds: { testcase_folder_id: target } }])
      : api(key, 'POST', '/testcase-folder/mapping/bulk/testcase?op=add',
          [{ ids: { testcase_folder_id: target, testcase_id: r.id } }]));
    console.log(`  moved ${c.id} → ${to}`);
  }
  console.log('\nDone.\n');
}

const rel = path.relative(root, SOURCE);
const { cases, errors } = validate(parsePlan(fs.readFileSync(SOURCE, 'utf8')));

if (errors.length) {
  console.error(`\n${rel} — ${errors.length} problem(s):\n`);
  for (const e of errors) console.error('  ' + e);
  console.error('\nSee the "Format" section of that file for the shape each case must take.\n');
  process.exit(1);
}

const byFolder = cases.reduce((acc, c) => ({ ...acc, [c.folder]: (acc[c.folder] || 0) + 1 }), {});

if (process.argv.includes('--push')) {
  push(cases, { write: process.argv.includes('--write') }).catch((e) => {
    console.error(`\n${e.message}\n`);
    process.exit(1);
  });
} else if (process.argv.includes('--check')) {
  console.log(`\nManual test cases: ${cases.length} valid`);
  for (const [f, n] of Object.entries(byFolder)) console.log(`  ${n}  ${f}`);
  console.log('');
} else {
  fs.writeFileSync(OUT, toCsv(cases));
  console.log(`\nWrote ${path.relative(root, OUT)} — ${cases.length} cases`);
  for (const [f, n] of Object.entries(byFolder)) console.log(`  ${n}  ${f}`);
  console.log('\nImport it in Testiny: project → Import → test cases → upload.\n');
}
