export const UNITS = {
  lb: {
    label: 'lb',
    labelPlural: 'lbs',
    toBase: (v) => v,
    fromBase: (v) => v,
    axisStep: 5,
  },
  kg: {
    label: 'kg',
    labelPlural: 'kg',
    toBase: (v) => v * 2.20462,
    fromBase: (v) => v / 2.20462,
    axisStep: 2,
  },
};

export const DEFAULT_UNIT = 'lb';

export function getUnit(key) {
  return UNITS[key] || UNITS[DEFAULT_UNIT];
}

export function toBase(value, unitKey) {
  return getUnit(unitKey).toBase(value);
}

export function fromBase(valueInBase, unitKey) {
  return getUnit(unitKey).fromBase(valueInBase);
}

export function formatWeight(valueInBase, unitKey, decimals = 1) {
  if (valueInBase == null || !Number.isFinite(valueInBase)) return '—';
  return fromBase(valueInBase, unitKey).toFixed(decimals);
}

export function formatSignedWeight(valueInBase, unitKey, decimals = 1) {
  if (valueInBase == null || !Number.isFinite(valueInBase)) return '—';
  const converted = fromBase(valueInBase, unitKey);
  const sign = converted > 0 ? '+' : converted < 0 ? '−' : '';
  return sign + Math.abs(converted).toFixed(decimals);
}

export function unitLabel(unitKey, value = null) {
  const unit = getUnit(unitKey);
  if (value != null && Math.abs(value) === 1) return unit.label;
  return unit.labelPlural;
}

export function axisStep(unitKey) {
  return getUnit(unitKey).axisStep;
}
