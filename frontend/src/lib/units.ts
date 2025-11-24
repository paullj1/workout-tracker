import type { UnitSystem, WeightUnit } from "../types/units";

const KG_TO_LB = 2.20462;

export const preferredWeightUnit = (preference: UnitSystem): WeightUnit => (preference === "metric" ? "kg" : "lb");

export const convertWeight = (value: number, from: WeightUnit, to: WeightUnit): number => {
  if (Number.isNaN(value) || value === null) return 0;
  if (from === to) return value;
  return from === "kg" ? value * KG_TO_LB : value / KG_TO_LB;
};

export const displayWeight = (
  value: number | null | undefined,
  fromUnit: WeightUnit,
  preference: UnitSystem,
): string => {
  if (value === null || value === undefined) return "-";
  const targetUnit = preferredWeightUnit(preference);
  const converted = convertWeight(value, fromUnit, targetUnit);
  const rounded = Math.round(converted * 10) / 10;
  return `${rounded} ${targetUnit}`;
};

export const toKgFromPreference = (value: number, preference: UnitSystem): number =>
  preference === "metric" ? value : value / KG_TO_LB;

export const fromKgToPreference = (value: number, preference: UnitSystem): number =>
  preference === "metric" ? value : value * KG_TO_LB;
