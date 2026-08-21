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

This pulls Electron (about 200MB on first install).

## Run

```bash
npm start
```

On first launch the app asks for a starting weight and a goal. All data lives
in a single `data.json` file in the per-user app support directory:

- macOS: `~/Library/Application Support/Weight Tracker/data.json`
- Windows: `%APPDATA%/Weight Tracker/data.json`
- Linux: `~/.config/Weight Tracker/data.json`

## Views

- **Today** shows the 7-day rolling average, the weekly delta, a progress ring,
  the log form, inline-editable start and goal, and a 30-day sparkline.
- **Trends** draws the full chart with 7D, 1M, 3M, 1Y, and all-time toggles,
  daily dots over a 7-day rolling average line and a dashed goal reference.
- **History** lists entries newest first, with per-row delete and a CSV export.
- **Settings** holds the unit (pounds or kilograms), the mode (bulk or cut),
  and the daily reminder.

Bulk mode treats gaining as progress and cut mode treats losing as progress, so
the goal and start weight are validated against whichever direction you pick.

## Reminder

When reminders are on, the app checks every minute and, once past the reminder
time (08:00 by default) on a day with no entry yet, opens a small frameless
window to log the weight. It can be snoozed or dismissed for the day. The app
keeps a menu-bar tray icon, closing the window hides it rather than quitting,
and it registers to start hidden at login on macOS and Windows.

## Data

Weights are stored in pounds and converted for display when the unit is set to
kilograms. Dates are ISO `YYYY-MM-DD`. Schema:

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

## Layout

```
electron/    main process, tray, IPC, reminder window
backend/     entries, stats, meta, storage, validation
renderer/    app UI, views, chart, pickers, units
reminder/    the reminder window's own page
scripts/     smoke test, projection test, spreadsheet import
```

## Scripts

- `npm start` launches the app
- `npm run smoke` exercises the full backend API against a temp directory
- `npm test` checks the projection math
- `node scripts/import-xlsx.js <path-to-xlsx> [year]` imports a spreadsheet
  with `Date` and `Weight (lbs)` columns into `data.json`
