import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import UnitToggle from "./UnitToggle";
const SettingsMenu = ({ userName, preference, resolvedTheme, onThemeChange, unitPreference, onUnitChange, onSignOut, }) => {
    const [open, setOpen] = useState(false);
    const popoverRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                setOpen(false);
            }
        };
        const handleEscape = (event) => {
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
    return (_jsxs("div", { className: "settings", children: [_jsx("button", { type: "button", className: "settings__trigger", onClick: () => setOpen((prev) => !prev), children: _jsx("span", { className: "settings__icon", "aria-hidden": "true", children: "\u2699\uFE0F" }) }), open && (_jsxs(_Fragment, { children: [_jsx("div", { className: "settings__backdrop", "aria-hidden": "true" }), _jsxs("div", { className: "settings__popover", ref: popoverRef, role: "dialog", "aria-label": "Settings", children: [_jsxs("div", { className: "settings__header", children: [_jsx("div", { className: "settings__avatar", "aria-hidden": "true", children: "\uD83D\uDCAA" }), _jsxs("div", { children: [_jsxs("p", { className: "settings__title", children: ["Hi, ", userName || "athlete", "!"] }), _jsx("p", { className: "settings__subtitle", children: "Tune your setup." })] })] }), _jsx(ThemeToggle, { preference: preference, resolvedTheme: resolvedTheme, onChange: onThemeChange }), _jsx(UnitToggle, { preference: unitPreference, onChange: onUnitChange }), onSignOut && (_jsxs("button", { type: "button", className: "settings__action", onClick: onSignOut, children: [_jsx("span", { "aria-hidden": "true", children: "\uD83D\uDEAA" }), " Sign out"] }))] })] }))] }));
};
export default SettingsMenu;
