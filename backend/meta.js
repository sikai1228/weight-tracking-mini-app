'use strict';

const { assertDate, assertPositiveNumber, todayISO } = require('./validate');

function createMetaApi(storage) {
  async function get() {
    const state = await storage.load();
    return {
      unit: state.unit ?? 'lb',
      mode: state.mode ?? 'bulk',
      goal: state.goal,
      startWeight: state.startWeight,
      startDate: state.startDate,
      isConfigured: state.goal != null && state.startWeight != null,
    };
  }

  async function updateUnit(value) {
    if (value !== 'lb' && value !== 'kg') throw new Error('unit must be lb or kg');
    return storage.update((state) => {
      state.unit = value;
      return { unit: value };
    });
  }

  async function updateMode(value) {
    if (value !== 'bulk' && value !== 'cut') throw new Error('mode must be bulk or cut');
    return storage.update((state) => {
      state.mode = value;
      return { mode: value };
    });
  }

  async function getReminder() {
    const state = await storage.load();
    return {
      remindersEnabled: state.remindersEnabled !== false,
      reminderTime: state.reminderTime ?? '08:00',
      lastReminderDate: state.lastReminderDate ?? null,
    };
  }

  async function setLastReminderDate(date) {
    return storage.update((state) => {
      state.lastReminderDate = date;
      return { lastReminderDate: date };
    });
  }

  async function setRemindersEnabled(value) {
    const enabled = value === true;
    return storage.update((state) => {
      state.remindersEnabled = enabled;
      return { remindersEnabled: enabled };
    });
  }

  async function setReminderTime(value) {
    if (typeof value !== 'string' || !/^\d{1,2}:\d{2}$/.test(value)) {
      throw new Error('reminderTime must be HH:MM');
    }
    return storage.update((state) => {
      state.reminderTime = value;
      return { reminderTime: value };
    });
  }

  async function setup({ startWeight, goal, startDate }) {
    assertPositiveNumber(startWeight, 'startWeight');
    assertPositiveNumber(goal, 'goal');
    const date = startDate ?? todayISO();
    assertDate(date, 'startDate');
    return storage.update((state) => {
      state.startWeight = startWeight;
      state.goal = goal;
      state.startDate = date;
      return { goal, startWeight, startDate: date };
    });
  }

  async function updateStartWeight(value) {
    assertPositiveNumber(value, 'startWeight');
    return storage.update((state) => {
      state.startWeight = value;
      return { startWeight: value };
    });
  }

  async function updateGoal(value) {
    assertPositiveNumber(value, 'goal');
    return storage.update((state) => {
      state.goal = value;
      return { goal: value };
    });
  }

  return {
    get, setup,
    updateStartWeight, updateGoal, updateUnit, updateMode,
    getReminder, setLastReminderDate, setRemindersEnabled, setReminderTime,
  };
}

module.exports = { createMetaApi };
