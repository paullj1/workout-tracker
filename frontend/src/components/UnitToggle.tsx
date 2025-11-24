import type { UnitSystem } from "../types/units";

type Props = {
  preference: UnitSystem;
  onChange: (preference: UnitSystem) => void;
};

const OPTIONS: { value: UnitSystem; label: string; icon: string; hint: string }[] = [
  { value: "metric", label: "Metric (kg)", icon: "📏", hint: "Kilograms, kilometers" },
  { value: "imperial", label: "Imperial (lb)", icon: "📐", hint: "Pounds, miles" },
];

const UnitToggle = ({ preference, onChange }: Props) => (
  <div className="theme-toggle" role="group" aria-label="Unit selection">
    <div className="theme-toggle__header">
      <span className="theme-toggle__title">
        <span aria-hidden="true">⚖️</span> Units
      </span>
      <span className="theme-toggle__hint">
        {preference === "metric" ? "Metric" : "Imperial"} preferred
      </span>
    </div>
    <div className="theme-toggle__choices">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`theme-toggle__chip ${preference === option.value ? "is-active" : ""}`}
          aria-pressed={preference === option.value}
          onClick={() => onChange(option.value)}
        >
          <span className="theme-toggle__icon" aria-hidden="true">
            {option.icon}
          </span>
          <span>
            {option.label}
            <small className="theme-toggle__micro-hint">{option.hint}</small>
          </span>
        </button>
      ))}
    </div>
  </div>
);

export default UnitToggle;
