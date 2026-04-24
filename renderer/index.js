'use strict';

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const settings = await window.api.settings.get();
    console.log('[weight-tracker] settings:', settings);
    const summary = await window.api.stats.summary();
    console.log('[weight-tracker] summary:', summary);
  } catch (err) {
    console.error('[weight-tracker] boot failed:', err);
  }
});
