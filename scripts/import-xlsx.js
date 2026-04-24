'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');

const APP_NAME = 'Weight Tracker';
const DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function userDataDir() {
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
  if (process.platform === 'win32') return path.join(process.env.APPDATA || '', APP_NAME);
  return path.join(os.homedir(), '.config', APP_NAME);
}

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseShortDate(text, year) {
  const d = new Date(`${text} ${year}`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function main() {
  const xlsxPath = process.argv[2] || path.join(__dirname, '..', 'Weight Tracker.xlsx');
  const yearArg = process.argv[3] ? Number(process.argv[3]) : new Date().getFullYear();

  const wb = XLSX.readFile(xlsxPath);
  const sheet = wb.Sheets['Weight Log'] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });

  const header = rows[0] || [];
  const dayIdx = header.indexOf('Day');
  const dateIdx = header.indexOf('Date');
  const weightIdx = header.indexOf('Weight (lbs)');
  if (dateIdx === -1 || weightIdx === -1) {
    throw new Error(`Could not locate Date/Weight columns in header: ${JSON.stringify(header)}`);
  }

  const entries = [];
  const skipped = [];
  const dowMismatches = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const dateText = r[dateIdx];
    const weightText = r[weightIdx];
    if (!dateText || weightText == null || weightText === '') continue;
    const weight = Number(weightText);
    if (!Number.isFinite(weight) || weight <= 0) { skipped.push({ row: i, reason: 'invalid weight', weightText }); continue; }
    const d = parseShortDate(dateText, yearArg);
    if (!d) { skipped.push({ row: i, reason: 'bad date', dateText }); continue; }

    if (dayIdx !== -1 && r[dayIdx]) {
      const expected = DOW[d.getDay()];
      if (r[dayIdx] !== expected) dowMismatches.push({ row: i, dateText, expected, got: r[dayIdx] });
    }

    entries.push({ date: toISO(d), weight: Number(weight.toFixed(1)) });
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));

  if (dowMismatches.length) {
    console.warn(`Warning: ${dowMismatches.length} day-of-week mismatches — wrong year (${yearArg})?`);
    console.warn(dowMismatches.slice(0, 3));
  }
  if (skipped.length) {
    console.log(`Skipped ${skipped.length} rows (missing/invalid weight).`);
  }

  console.log(`Parsed ${entries.length} entries, ${entries[0].date} → ${entries[entries.length - 1].date}`);
  console.log(`First: ${entries[0].weight} lbs, last: ${entries[entries.length - 1].weight} lbs`);

  const dataDir = userDataDir();
  fs.mkdirSync(dataDir, { recursive: true });
  const dataPath = path.join(dataDir, 'data.json');

  let existing = { goal: null, startWeight: null, startDate: null, entries: [] };
  if (fs.existsSync(dataPath)) {
    existing = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  }

  const merged = {
    goal: existing.goal ?? null,
    startWeight: entries[0].weight,
    startDate: entries[0].date,
    entries,
  };

  const backupPath = dataPath + '.bak-' + Date.now();
  if (fs.existsSync(dataPath)) fs.copyFileSync(dataPath, backupPath);

  fs.writeFileSync(dataPath, JSON.stringify(merged, null, 2), 'utf8');
  console.log(`\nWrote ${dataPath}`);
  if (fs.existsSync(backupPath)) console.log(`Backup at ${backupPath}`);
  console.log(`Start: ${merged.startWeight} lbs on ${merged.startDate}`);
  console.log(`Goal: ${merged.goal == null ? '(not set)' : merged.goal + ' lbs'}`);
}

main();
