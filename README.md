# Weight tracker

A small, local-only desktop app for tracking daily weight, goals, and trends.
Built with Electron. No network calls, no accounts, no API keys.

## Requirements

- Node.js 18 or newer
- npm

## Install

```bash
npm install
```

This pulls Electron (~200 MB download on first install).

## Run

```bash
npm start
```

On first launch the app will prompt for a starting weight and goal. All data is
stored in a single `data.json` file inside the OS per-user app support directory:

- macOS: `~/Library/Application Support/Weight Tracker/data.json`
- Windows: `%APPDATA%/Weight Tracker/data.json`
- Linux: `~/.config/Weight Tracker/data.json`

## Views

- **Today** — 7-day rolling average, weekly delta, progress ring, log form, inline-editable start/goal, 30-day sparkline.
- **Trends** — full chart with 7D / 1M / 3M / 1Y / All period toggles, daily dots overlaid with a 7-day rolling average line and a dashed goal reference.
- **History** — reverse-chronological table with per-row delete and a CSV export button.

## Data

All weights are stored in pounds. Dates are ISO `YYYY-MM-DD`. Schema:

```json
{
  "goal": 125,
  "startWeight": 112,
  "startDate": "2026-01-24",
  "entries": [
    { "date": "2026-04-24", "weight": 117.0 }
  ]
}
```

## Scripts

- `npm start` — launch the app
- `npm run smoke` — run the backend smoke test (exercises the full API against a temp directory)
- `node scripts/import-xlsx.js <path-to-xlsx> [year]` — import a spreadsheet with `Date` and `Weight (lbs)` columns into `data.json`
