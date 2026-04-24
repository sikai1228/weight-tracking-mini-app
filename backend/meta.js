'use strict';

const { assertDate, assertPositiveNumber, todayISO } = require('./validate');

function createMetaApi(storage) {
  async function get() {
    const state = await storage.load();
    return {
      unit: state.unit ?? 'lb',
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

  return { get, setup, updateStartWeight, updateGoal, updateUnit };
}

module.exports = { createMetaApi };
