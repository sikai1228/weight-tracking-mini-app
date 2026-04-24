'use strict';

const path = require('path');
const XLSX = require('xlsx');

const file = process.argv[2] || path.join(__dirname, '..', 'Weight Tracker.xlsx');
const wb = XLSX.readFile(file, { cellDates: true });

console.log('Sheets:', wb.SheetNames);
for (const name of wb.SheetNames) {
  const sheet = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
  console.log(`\n=== ${name} (${rows.length} rows) ===`);
  rows.slice(0, 10).forEach((r, i) => console.log(i, JSON.stringify(r)));
  if (rows.length > 10) console.log('...');
  console.log('last:', JSON.stringify(rows[rows.length - 1]));
}
