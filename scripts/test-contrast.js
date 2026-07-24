// WCAG AA contrast checks for the app's palette (src/theme.js).
//
// A design review found the light theme's secondary text at 2.9–3.3:1 and
// dark-mode primary buttons at 2.1:1. These assertions lock in the fixes so a
// future palette tweak can't silently regress them.
//
// Thresholds (WCAG 2.1 AA):
//   • normal text        4.5:1
//   • large text         3.0:1  (≥18px, or ≥14px bold)
//   • non-text UI        3.0:1  (icons, meaningful borders)
//   node scripts/test-contrast.js   (or via: npm test)
const babel = require('@babel/core');
const assert = require('assert');
const path = require('path');

function loadTheme() {
  const file = path.join(__dirname, '..', 'src/theme.js');
  const code = babel.transformFileSync(file, {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const m = { exports: {} };
  new Function('module', 'exports', 'require', code)(m, m.exports, require);
  return m.exports;
}

// Relative luminance / contrast ratio per WCAG 2.1.
function luminance(hex) {
  const h = hex.replace('#', '');
  const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, b] = ch.map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const { lightColors: L, darkColors: D } = loadTheme();

let pass = 0;
let fail = 0;
const out = [];
function check(name, fg, bg, need) {
  const r = contrast(fg, bg);
  try {
    assert.ok(
      r >= need,
      `${fg} on ${bg} is ${r.toFixed(2)}:1, needs ${need}:1`
    );
    out.push(`  ok   ${name} (${r.toFixed(2)}:1)`);
    pass++;
  } catch (e) {
    out.push(`  FAIL ${name}\n       ${e.message}`);
    fail++;
  }
}

const TEXT = 4.5;
const UI = 3.0;

for (const [label, C] of [['light', L], ['dark', D]]) {
  // Body + secondary text on every surface it can land on.
  for (const surface of ['bg', 'card', 'faint']) {
    check(`${label}: text on ${surface}`, C.text, C[surface], TEXT);
    check(`${label}: muted on ${surface}`, C.muted, C[surface], TEXT);
  }
  // Status colours: small bold tallies on Statistics use these as TEXT.
  check(`${label}: correct on bg`, C.correct, C.bg, TEXT);
  check(`${label}: wrong on bg`, C.wrong, C.bg, TEXT);
  // Headings / links.
  check(`${label}: primaryDark on bg`, C.primaryDark, C.bg, TEXT);
  // Primary button label on the brand fill — large bold text.
  check(`${label}: onPrimary on primary`, C.onPrimary, C.primary, UI);
  // The flag icon is non-text UI.
  check(`${label}: flag icon on bg`, C.flag, C.bg, UI);
  check(`${label}: flag icon on faint`, C.flag, C.faint, UI);
}

console.log(out.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
