import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const OPTIONS = [
    { value: "system", label: "System", icon: "🖥️" },
    { value: "light", label: "Light", icon: "🌞" },
    { value: "dark", label: "Dark", icon: "🌙" },
];
const ThemeToggle = ({ preference, resolvedTheme, onChange }) => (_jsxs("div", { className: "theme-toggle", role: "group", "aria-label": "Theme selection", children: [_jsxs("div", { className: "theme-toggle__header", children: [_jsxs("span", { className: "theme-toggle__title", children: [_jsx("span", { "aria-hidden": "true", children: "\uD83C\uDFA8" }), " Theme"] }), _jsxs("span", { className: "theme-toggle__hint", children: ["Using ", resolvedTheme, " mode"] })] }), _jsx("div", { className: "theme-toggle__choices", children: OPTIONS.map((option) => (_jsxs("button", { type: "button", className: `theme-toggle__chip ${preference === option.value ? "is-active" : ""}`, "aria-pressed": preference === option.value, onClick: () => onChange(option.value), children: [_jsx("span", { className: "theme-toggle__icon", "aria-hidden": "true", children: option.icon }), option.label] }, option.value))) })] }));
export default ThemeToggle;
