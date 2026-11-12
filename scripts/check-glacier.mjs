#!/usr/bin/env node
/**
 * Glacier design system checker.
 *
 * Fails (exit 1) when frontend source uses styling the Glacier system does not
 * allow. Runs as part of `npm run build`; run on its own with
 * `npm run check:glacier`.
 *
 * Colours: Tailwind palette classes (gray-500, primary-600, ...) are allowed
 * because tailwind.config.js maps every palette onto Glacier tokens. What is
 * NOT allowed is anything that bypasses the tokens: raw hex/rgb values,
 * coloured shadows, decorative gradients, and so on.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SRC = join(ROOT, 'src');
const EXTENSIONS = new Set(['.tsx', '.ts', '.html', '.css']);
const SKIP_DIRS = new Set(['dist', 'node_modules', 'content', 'background', 'lib']);

/**
 * Files or lines that may hold literal colours, with the reason.
 * Keep this list short: every entry is a place the tokens cannot reach.
 */
const EXEMPT_FILES = {
  'src/styles/glacier-tokens.css': 'the token definitions themselves',
  'src/preferences/PreferencesPage.tsx': 'standalone page without the token stylesheet; its G constant holds Glacier token values',
  'src/dashboard/public/sw.js': 'not UI',
};
const EXEMPT_RULES_BY_FILE = {
  // SVG chart attributes and canvas drawing cannot read CSS variables; values are Glacier families
  'src/dashboard/OverviewTab.tsx': ['raw-colour'],
  'src/dashboard/GraphTab.tsx': ['raw-colour'],
  // Outreach email HTML sent to recruiters is email content, not app UI
  'src/dashboard/LeadsFlowTab.tsx': ['raw-colour', 'emoji', 'font-family'],
  // Recruiter lead email templates (email HTML, moved out of LeadsFlowTab)
  'src/shared/leadEmail.ts': ['raw-colour', 'emoji', 'font-family'],
  // Approved Assistant visual exception (PRODUCT.md, 2026-11-13): aurora, glow and glass live in this file
  'src/dashboard/assistant/assistant.css': ['raw-colour', 'gradient', 'blur', 'arbitrary-shadow'],
  'src/dashboard/RecruiterDashboard.tsx': ['raw-colour'],
  // Blue.cc tag colours come from Blue.cc at runtime
  'src/blue/App.tsx': [],
};
// The Glacier app-icon recipe: 160deg app-icon gradient plus a soft top-left highlight
const ALLOWED_SNIPPETS = [
  'bg-gradient-to-br from-app-icon-1 to-app-icon-2',
  'bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.35),transparent_55%)]',
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]',
  'shadow-[inset_0_0_0_1px_rgb(var(--g-stroke-card))]',
];

const RULES = [
  { id: 'raw-colour', why: 'use a Glacier token or a mapped palette class, not a literal colour',
    re: /(?:\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|placeholder|decoration|caret|shadow|accent)-\[(?:#|rgba?\(|hsla?\())|(?:(?:color|background|backgroundColor|borderColor|fill|stroke)\s*:\s*['"`](?:#[0-9a-fA-F]{3,8}|rgba?\(\s*\d))|(?:(?:^|[;{\s"'])(?:color|background(?:-color)?|border(?:-color)?)\s*:\s*#[0-9a-fA-F]{3,8})/ },
  { id: 'arbitrary-shadow', why: 'use shadow-card, shadow-raised, shadow-dialog or shadow-flyout',
    re: /\bshadow-\[/ },
  { id: 'shadow-colour', why: 'Glacier shadows are fixed tokens; remove coloured shadow utilities',
    re: /\bshadow-(?:black|white|gray|slate|zinc|neutral|stone|primary|blue|sky|cyan|teal|indigo|violet|purple|emerald|green|red|amber|yellow|orange|rose|pink)(?:-\d+)?(?:\/\d+)?\b/ },
  { id: 'font-weight', why: 'Onest 400, 500 and 600 only: use font-normal, font-medium or font-semibold',
    re: /\bfont-(?:thin|extralight|light|bold|extrabold|black)\b/ },
  { id: 'font-size', why: 'use the Glacier ramp (text-xs 12, text-sm 14, text-base 16, text-xl 20, text-2xl 24, text-3xl 28, text-4xl 40)',
    re: /\btext-\[\d+(?:\.\d+)?(?:px|rem)\]/ },
  { id: 'tracking', why: 'body text is never tracked; headings get their tracking from the base styles',
    re: /\btracking-(?:tighter|tight|wide|wider|widest|\[)/ },
  { id: 'uppercase', why: 'Glacier copy is sentence case', re: /(?<![\w-])uppercase(?![\w-])/ },
  { id: 'radius', why: 'use rounded (4), rounded-md (6), rounded-lg (8), rounded-xl (12), rounded-2xl (16) or rounded-full',
    re: /\brounded(?:-[trblse]{1,2})?-(?:3xl|sm|\[(?!9px\]|14px\]))/ },
  { id: 'gradient', why: 'the only gradients are the app icon and the canvas wash',
    re: /\bbg-gradient-to-|\bbg-\[(?:linear|radial)-gradient|bg-clip-text/ },
  { id: 'blur', why: 'no glass effects; chrome uses the glacier-chrome class',
    re: /\bbackdrop-blur(?:-\w+)?\b|\bblur-\[/ },
  { id: 'motion', why: 'hover is a background change, not a scale or lift',
    re: /\b(?:hover|group-hover|active|focus):(?:-?scale|-?translate|rotate)-/ },
  { id: 'focus-ring', why: 'never remove or replace the Glacier double focus ring',
    re: /(?:\bfocus(?:-visible|-within)?:(?:outline-none|ring|shadow-\[)|(?<![\w:-])outline-none\b)/ },
  { id: 'disabled-opacity', why: 'disabled controls use fg-subtle on bg-subtle, not opacity',
    re: /\bdisabled:opacity-\d+/ },
  { id: 'font-family', why: 'Onest for text and JetBrains Mono for IDs only',
    re: /(?:font-family\s*:|fontFamily\s*:)[^;'"`]*['"`]?\s*['"]?(?:Inter|Helvetica|Arial|Roboto)\b|family=Inter/ },
  { id: 'emoji', why: 'no emoji in UI copy',
    re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2B50}\u{2B55}]/u },
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) yield* walk(p);
    } else if (EXTENSIONS.has(extname(name))) {
      yield p;
    }
  }
}

const violations = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file).split('\\').join('/');
  if (EXEMPT_FILES[rel]) continue;
  const exempt = new Set(EXEMPT_RULES_BY_FILE[rel] || []);
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((raw, i) => {
    if (/console\.(log|warn|error|info|debug)|^\s*(\/\/|\*|\/\*)/.test(raw)) return;
    if (raw.includes('glacier-allow')) return;
    let line = raw;
    for (const s of ALLOWED_SNIPPETS) line = line.split(s).join('');
    for (const rule of RULES) {
      if (exempt.has(rule.id)) continue;
      const m = line.match(rule.re);
      if (m) violations.push({ rel, line: i + 1, rule: rule.id, why: rule.why, hit: m[0] });
    }
  });
}

if (violations.length) {
  const byRule = {};
  for (const v of violations) (byRule[v.rule] ??= []).push(v);
  for (const [rule, list] of Object.entries(byRule)) {
    console.error(`\n✗ ${rule} (${list.length}): ${list[0].why}`);
    for (const v of list.slice(0, 15)) console.error(`  ${v.rel}:${v.line}  ${v.hit}`);
    if (list.length > 15) console.error(`  … and ${list.length - 15} more`);
  }
  console.error(`\nGlacier check failed: ${violations.length} violation(s).`);
  process.exit(1);
}
console.log('Glacier check passed.');
