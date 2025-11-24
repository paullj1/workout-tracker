import { useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import UnitToggle from "./UnitToggle";
import type { Theme, ThemePreference } from "../types/theme";
import type { UnitSystem } from "../types/units";

type Props = {
  userName?: string;
  preference: ThemePreference;
  resolvedTheme: Theme;
  onThemeChange: (preference: ThemePreference) => void;
  unitPreference: UnitSystem;
  onUnitChange: (preference: UnitSystem) => void;
  onSignOut?: () => void;
};

const SettingsMenu = ({
  userName,
  preference,
  resolvedTheme,
  onThemeChange,
  unitPreference,
  onUnitChange,
  onSignOut,
}: Props) => {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="settings">
      <button type="button" className="settings__trigger" onClick={() => setOpen((prev) => !prev)}>
        <span className="settings__icon" aria-hidden="true">
          ⚙️
        </span>
        <span className="settings__label">Settings</span>
      </button>

      {open && (
        <>
          <div className="settings__backdrop" aria-hidden="true" />
          <div className="settings__popover" ref={popoverRef} role="dialog" aria-label="Settings">
            <div className="settings__header">
              <div className="settings__avatar" aria-hidden="true">
                💪
              </div>
              <div>
                <p className="settings__title">Hi, {userName || "athlete"}!</p>
                <p className="settings__subtitle">Tune your setup.</p>
              </div>
            </div>

            <ThemeToggle preference={preference} resolvedTheme={resolvedTheme} onChange={onThemeChange} />
            <UnitToggle preference={unitPreference} onChange={onUnitChange} />

            {onSignOut && (
              <button type="button" className="settings__action" onClick={onSignOut}>
                <span aria-hidden="true">🚪</span> Sign out
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SettingsMenu;
