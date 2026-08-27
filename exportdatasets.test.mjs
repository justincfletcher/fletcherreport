/* Offline test: stubs the Airtable API so export-datasets.mjs runs end to end
 * against records that carry the exact junk we know is in the base. */

const MFR = [
  { id: 'recBIGTEX', fields: { Name: 'Big Tex', 'Live on Site': true } },
  { id: 'recPJ',     fields: { Name: 'PJ Trailers', 'Live on Site': true } },
  { id: 'recSURE',   fields: { Name: 'Sure-Trac' } },          // curated, NOT live
];

const FAM = [
  { id: 'recF1', fields: {
      'Family Name': '14GN', Brand: ['recBIGTEX'], Category: 'Gooseneck',
      'Primary Hitch Type': 'Gooseneck', 'Main Frame Material': 'Steel',
      'Crossmember Spacing (in)': 16, 'Axle Brand': 'Dexter',
      'Coupler Brand': 'N/A (ball/crank type, not branded)',   // must become null
      'Standard Connection': ['Gooseneck Ball'],
      'Trailer Structural Warranty': '3 year',
  }},
  { id: 'recF2', fields: {
      'Family Name': '83', Brand: ['recPJ'], Category: 'Utility',   // numeric-looking name
      'Primary Hitch Type': 'Bumper Pull', 'Coupler Brand': 'Demco',
      'Standard Connection': ['2" Ball'],
  }},
  { id: 'recF3', fields: {
      'Family Name': 'Tube Top Utility', Brand: ['recSURE'],        // brand not live
      Category: 'Utility',
  }},
];

const SPEC = [
  // normal row, commas and units
  { id: 'r1', fields: { 'Model Family Link': ['recF1'], 'Data Status': 'Verified',
      'GVWR (lbs)': '14,000', 'Payload Capacity (lbs)': '9,880 lb',
      'Curb Weight (lbs)': '4120', 'Axle Count': '2',
      'Overall Length (ft)': "25'", 'Deck Width (in)': '83"',
      'Tire Size': 'ST235/80R16', 'Coupler Type': '2-5/16" Adjustable' }},
  // the sentinel string that must never reach the site
  { id: 'r2', fields: { 'Model Family Link': ['recF1'], 'Data Status': 'Needs Review',
      'GVWR (lbs)': '23,900', 'Overall Length (ft)': 'Not found on website',
      'Deck Length (ft)': '30', 'Axle Count': '2', 'Jack Type': 'N/A' }},
  // numeric-looking family name must survive as a string
  { id: 'r3', fields: { 'Model Family Link': ['recF2'], 'Data Status': 'Verified',
      'GVWR (lbs)': '2990', 'Overall Length (ft)': '12', 'Axle Count': '1' }},
  // curated but brand not live — must be skipped
  { id: 'r4', fields: { 'Model Family Link': ['recF3'], 'Data Status': 'Verified',
      'GVWR (lbs)': '7000', 'Deck Length (ft)': '10' }},
  // draft status — must be skipped
  { id: 'r5', fields: { 'Model Family Link': ['recF1'], 'Data Status': 'Draft',
      'GVWR (lbs)': '9900' }},
  // orphan, no family link — must be skipped
  { id: 'r6', fields: { 'Data Status': 'Verified', 'GVWR (lbs)': '9900' }},
  // ambiguous range — should publish with a warning
  { id: 'r7', fields: { 'Model Family Link': ['recF2'], 'Data Status': 'Verified',
      'GVWR (lbs)': '7000', 'Axle Rating (lbs)': '3500 - 5200',
      'Overall Length (ft)': '16' }},
  // no dimensions at all — must be dropped
  { id: 'r8', fields: { 'Model Family Link': ['recF2'], 'Data Status': 'Verified',
      'Tire Size': 'ST205/75R15' }},
];

const TABLES = {
  tblwLANpUxGcdtqFO: MFR,
  tbllYzviLRuLzM9MO: FAM,
  tblVtYVzvZGpns9C4: SPEC,
};

globalThis.fetch = async (url) => {
  const tbl = Object.keys(TABLES).find(t => String(url).includes(t));
  return { ok: true, status: 200, json: async () => ({ records: TABLES[tbl] }) };
};

process.env.AIRTABLE_TOKEN = 'test';
process.env.OUT = '/tmp/datasets.test.js';
await import('./export-datasets.mjs');
