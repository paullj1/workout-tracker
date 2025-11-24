import type { Theme, ThemePreference } from "../types/theme";

type Props = {
  preference: ThemePreference;
  resolvedTheme: Theme;
  onChange: (preference: ThemePreference) => void;
};

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: string }> = [
  { value: "system", label: "System", icon: "🖥️" },
  { value: "light", label: "Light", icon: "🌞" },
  { value: "dark", label: "Dark", icon: "🌙" },
];

const ThemeToggle = ({ preference, resolvedTheme, onChange }: Props) => (
  <div className="theme-toggle" role="group" aria-label="Theme selection">
    <div className="theme-toggle__header">
      <span className="theme-toggle__title">
        <span aria-hidden="true">🎨</span> Theme
      </span>
      <span className="theme-toggle__hint">Using {resolvedTheme} mode</span>
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
          {option.label}
        </button>
      ))}
    </div>
  </div>
);

export default ThemeToggle;
