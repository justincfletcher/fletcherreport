#!/usr/bin/env node
/* Fletcher Report — Airtable → datasets.js exporter
 *
 * Reads the Trailer Index Spec Database and writes datasets.js, the static data
 * file the /compare engine fetches.
 *
 * THE PUBLISH GATE — read this before changing anything:
 *   A SKU is published only if ALL THREE are true:
 *     1. Its manufacturer has "Live on Site" checked.
 *     2. It is linked to a Model Family.
 *     3. Its Data Status is Verified or Needs Review.
 *   Curated is NOT the same as live. Unchecking "Live on Site" pulls a brand
 *   off the site on the next run. That is the point of the flag.
 *
 * Env:
 *   AIRTABLE_TOKEN  (required) read-only PAT: data.records:read + schema.bases:read
 *   OUT             (optional) output path, default ./datasets.js
 *
 * Node 20+. No dependencies.
 */

const BASE = 'app4T5cwR6i3iqoap';
const TOKEN = process.env.AIRTABLE_TOKEN;
const OUT = process.env.OUT || 'datasets.js';

if (!TOKEN) {
  console.error('AIRTABLE_TOKEN is not set. Add it as a repository secret.');
  process.exit(1);
}

const T = {
  manufacturers: 'tblwLANpUxGcdtqFO',
  families:      'tbllYzviLRuLzM9MO',
  specs:         'tblVtYVzvZGpns9C4',
};

/* ---------------------------------------------------------------- fetching */

async function fetchAll(tableId, fields) {
  const rows = [];
  let offset;
  do {
    const p = new URLSearchParams();
    p.set('pageSize', '100');
    for (const f of fields) p.append('fields[]', f);
    if (offset) p.set('offset', offset);

    const url = `https://api.airtable.com/v0/${BASE}/${tableId}?${p}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });

    if (res.status === 429) {                   // Airtable rate limit: back off and retry
      await new Promise(r => setTimeout(r, 1500));
      continue;
    }
    if (!res.ok) {
      throw new Error(`Airtable ${tableId} → ${res.status} ${await res.text()}`);
    }
    const j = await res.json();
    rows.push(...j.records);
    offset = j.offset;
  } while (offset);
  return rows;
}

/* -------------------------------------------------------------- sanitizing */

/* Values that mean "we do not have this", stored in the base as if they were
 * data. Publishing any of these as a spec would be the site telling a lie in a
 * tidy font. "Not found on website" in particular IS present in the base. */
const NULLISH = new Set([
  '', '-', '--', '—', 'n/a', 'na', 'n/a.', 'none', 'null', 'tbd', 'tba',
  'unknown', 'not found', 'not found on website', 'not listed',
  'not specified', 'not published', 'varies', 'see dealer',
]);

const warnings = [];

function clean(v) {
  if (v == null) return null;
  if (Array.isArray(v)) v = v[0];              // lookups / multi-selects
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (NULLISH.has(s.toLowerCase())) return null;
  /* "N/A (ball/pipe type)" and its twelve friends — these are live filter chips
   * on the site today and are noise, not brands. Anything that opens with N/A
   * is an absence, however it is parenthesised. */
  if (/^n\/?a\b/i.test(s)) return null;
  return s;
}

function num(v, ctx) {
  const s = clean(v);
  if (s == null) return null;
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  /* Strip thousands separators, then take the first number in the string so
   * "14,000 lb", "20'", "83\"" and "7000#" all land correctly. */
  const m = String(s).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  if (!Number.isFinite(n)) return null;
  /* A value with more than one number in it is a range or a pair, and picking
   * the first one is a guess. Publish it, but say so in the log. */
  if (/\d[^\d]+\d/.test(String(s).replace(/,/g, ''))) {
    warnings.push(`${ctx}: took ${n} from ambiguous "${s}"`);
  }
  return n;
}

const first = (...vals) => {                    // first non-null, SKU beats family
  for (const v of vals) { const c = clean(v); if (c != null) return c; }
  return null;
};

/* ------------------------------------------------------------------- build */

/* Key order MUST match the engine's SCHEMA.fields keys. The engine drops any
 * column that is null on every row, so a brand missing a spec degrades quietly
 * rather than showing an empty column. */
const COLS = [
  'brand', 'family', 'gvwr', 'payload', 'curb', 'axles', 'category', 'hitch',
  'length', 'deckLen', 'width', 'axleBrand', 'rating', 'suspension', 'brake',
  'axleLube', 'coupler', 'couplerBrand', 'jack', 'tire', 'tireLoad',
  'frameMat', 'crossmember', 'ibeamWt', 'ibeamHt', 'paint', 'fenderMount',
  'extLight', 'plug', 'country', 'warranty', 'coating',
];

const PUBLISHABLE = new Set(['Verified', 'Needs Review']);

async function main() {
  const [mfrRecs, famRecs, specRecs] = await Promise.all([
    fetchAll(T.manufacturers, ['Name', 'Live on Site']),
    fetchAll(T.families, [
      'Family Name', 'Brand', 'Category', 'Primary Hitch Type',
      'Main Frame Material', 'Frame I-Beam Weight (lbs/ft)',
      'Frame I-Beam Height (in)', 'Crossmember Spacing (in)', 'Axle Brand',
      'Axle Lubrication Type', 'Suspension Type', 'Coupler Brand',
      'Coupler Type', 'Standard Connection', 'Brake System', 'Fender Mount',
      'Paint System', 'Trailer Structural Warranty', 'Coating Warranty',
      'Country of Manufacture',
    ]),
    fetchAll(T.specs, [
      'Model Family Link', 'Data Status', 'Model Family',
      'GVWR (lbs)', 'Payload Capacity (lbs)', 'Curb Weight (lbs)',
      'Axle Count', 'Overall Length (ft)', 'Deck Length (ft)',
      'Deck Width (in)', 'Axle Rating (lbs)', 'Tire Size', 'Tire Load Rating',
      'Jack Type', 'Plug Type', 'Exterior Light type', 'Coupler Type',
      'Axle Lubrication Type', 'Brake System', 'Suspension Type (SKU)',
    ]),
  ]);

  const live = new Map();                       // mfr recId → brand name
  for (const r of mfrRecs) {
    if (r.fields['Live on Site']) live.set(r.id, clean(r.fields['Name']));
  }
  if (!live.size) {
    console.error('No manufacturer has "Live on Site" checked. Refusing to '
      + 'publish an empty site. Check at least one brand and re-run.');
    process.exit(1);
  }

  const fam = new Map(famRecs.map(r => [r.id, r.fields]));

  const byBrand = new Map();
  let skippedNotLive = 0, skippedNoFamily = 0, skippedStatus = 0;

  for (const rec of specRecs) {
    const f = rec.fields;

    const famId = (f['Model Family Link'] || [])[0];
    if (!famId) { skippedNoFamily++; continue; }

    const ff = fam.get(famId);
    if (!ff) { skippedNoFamily++; continue; }

    const brandId = (ff['Brand'] || [])[0];
    const brand = brandId && live.get(brandId);
    if (!brand) { skippedNotLive++; continue; }

    if (!PUBLISHABLE.has(clean(f['Data Status']))) { skippedStatus++; continue; }

    const where = `${brand} ${clean(ff['Family Name']) || rec.id}`;

    const row = {
      brand,
      family:       first(ff['Family Name'], f['Model Family']),
      gvwr:         num(f['GVWR (lbs)'], `${where} GVWR`),
      payload:      num(f['Payload Capacity (lbs)'], `${where} payload`),
      curb:         num(f['Curb Weight (lbs)'], `${where} curb`),
      axles:        num(f['Axle Count'], `${where} axles`),
      category:     clean(ff['Category']),
      hitch:        clean(ff['Primary Hitch Type']),
      length:       num(f['Deck Length (ft)'], `${where} deck length`)
                 ?? num(f['Overall Length (ft)'], `${where} length`),
      deckLen:      null,   /* overall length: collected in Airtable, not shown on the site yet */
      width:        num(f['Deck Width (in)'], `${where} width`),
      axleBrand:    clean(ff['Axle Brand']),
      rating:       num(f['Axle Rating (lbs)'], `${where} axle rating`),
      suspension:   first(f['Suspension Type (SKU)'], ff['Suspension Type']),
      brake:        first(f['Brake System'], ff['Brake System']),
      axleLube:     first(f['Axle Lubrication Type'], ff['Axle Lubrication Type']),
      coupler:      first(f['Coupler Type'], ff['Standard Connection'], ff['Coupler Type']),
      couplerBrand: clean(ff['Coupler Brand']),
      jack:         clean(f['Jack Type']),
      tire:         clean(f['Tire Size']),
      tireLoad:     clean(f['Tire Load Rating']),
      frameMat:     clean(ff['Main Frame Material']),
      crossmember:  num(ff['Crossmember Spacing (in)'], `${where} crossmember`),
      ibeamWt:      num(ff['Frame I-Beam Weight (lbs/ft)'], `${where} ibeamWt`),
      ibeamHt:      num(ff['Frame I-Beam Height (in)'], `${where} ibeamHt`),
      paint:        clean(ff['Paint System']),
      fenderMount:  clean(ff['Fender Mount']),
      extLight:     clean(f['Exterior Light type']),
      plug:         clean(f['Plug Type']),
      country:      clean(ff['Country of Manufacture']),
      warranty:     clean(ff['Trailer Structural Warranty']),
      coating:      clean(ff['Coating Warranty']),
    };

    /* A row with no GVWR and no length is not comparable — it would sit in the
     * table as a line of dashes and make the site look unfinished. */
    if (row.gvwr == null && row.length == null && row.deckLen == null) {
      warnings.push(`${where}: dropped, no GVWR and no length of either kind`);
      continue;
    }

    if (!byBrand.has(brand)) byBrand.set(brand, []);
    byBrand.get(brand).push(COLS.map(c => row[c] ?? null));
  }

  const DATASETS = [...byBrand.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([brand, rows]) => ({ brand, rows }));

  const total = DATASETS.reduce((n, d) => n + d.rows.length, 0);
  if (!total) {
    console.error('Zero publishable rows. Refusing to overwrite datasets.js.');
    process.exit(1);
  }

  const out =
    `/* Fletcher Report — generated ${new Date().toISOString()}\n` +
    ` * DO NOT EDIT BY HAND. Written by scripts/export-datasets.mjs from Airtable.\n` +
    ` * ${total} models across ${DATASETS.length} brands.\n */\n` +
    `const COLS=${JSON.stringify(COLS)};\n` +
    `const DATASETS=[\n` +
    DATASETS.map(d =>
      `{brand:${JSON.stringify(d.brand)},rows:[\n` +
      d.rows.map(r => JSON.stringify(r)).join(',\n') +
      `\n]}`).join(',\n') +
    `\n];\n`;

  await (await import('node:fs/promises')).writeFile(OUT, out, 'utf8');

  console.log(`\nWrote ${OUT} — ${total} models, ${DATASETS.length} brands`);
  for (const d of DATASETS) console.log(`  ${String(d.rows.length).padStart(5)}  ${d.brand}`);
  console.log(`\nSkipped: ${skippedNotLive} not-live brand, `
    + `${skippedNoFamily} no family link, ${skippedStatus} status not publishable`);

  if (warnings.length) {
    console.log(`\n${warnings.length} data warnings (published anyway unless noted):`);
    for (const w of warnings.slice(0, 60)) console.log(`  ! ${w}`);
    if (warnings.length > 60) console.log(`  … and ${warnings.length - 60} more`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
