// ASCII-safe shadow of src/utils/scoring.js -- used ONLY by the design-sync
// preview bundle, swapped in via tsconfig paths (.design-sync/tsconfig.ds.json).
//
// The real module writes its regexes with LITERAL non-ASCII characters (the
// combining-diacritics range etc). esbuild ships regex literals verbatim, so
// the DS bundle carries raw multi-byte regex bytes; evaluated in any document
// not decoded as UTF-8 (the claude.ai/design self-check and the validate
// smoke-check load path) the U+0300-U+036F class mojibakes into an out-of-order
// range that throws at parse time and takes down window.Poold -- every preview
// then breaks. Building the regexes from String.fromCharCode keeps THIS source
// pure-ASCII, so the bundle is charset-immune while staying behaviour-identical.
// Only the exports the synced components import are reproduced.
// LATENT BUG: same crash can hit the real app if its bundle is ever loaded as
// non-UTF-8 -- worth fixing at source. Keep in sync with the real module.

const cc = String.fromCharCode;

// Atomic letters NFD does not decompose (codepoints, not base+accent).
const ATOMIC_CODES = [0xf8, 0xe6, 0x153, 0xf0, 0xfe, 0x142, 0x111, 0xdf, 0x131, 0x127];
const ATOMIC_VALUES = ['o', 'ae', 'oe', 'd', 'th', 'l', 'd', 'ss', 'i', 'h'];
const TRANSLITERATIONS = {};
ATOMIC_CODES.forEach((code, i) => { TRANSLITERATIONS[cc(code)] = ATOMIC_VALUES[i]; });

const reAtomic = new RegExp('[' + ATOMIC_CODES.map(cc).join('') + ']', 'g');
const reCombining = new RegExp('[' + cc(0x300) + '-' + cc(0x36f) + ']', 'g');
const rePunct = new RegExp("['" + cc(0x2019) + '.]', 'g');
const reDash = new RegExp('[-' + cc(0x2013) + cc(0x2014) + '_]', 'g');

export function parseScore(total) {
  if (!total || total === '-' || total === '') return null;
  if (total === 'E') return 0;
  const n = parseInt(total, 10);
  return isNaN(n) ? null : n;
}

export function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(reAtomic, c => TRANSLITERATIONS[c])
    .normalize('NFD')
    .replace(reCombining, '')
    .replace(rePunct, '')
    .replace(reDash, ' ')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatScore(score) {
  if (score === null || score === undefined) return cc(0x2013);
  if (score === 0) return 'E';
  return score > 0 ? `+${score}` : `${score}`;
}
