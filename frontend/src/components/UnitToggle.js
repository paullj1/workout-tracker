import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const OPTIONS = [
    { value: "metric", label: "Metric (kg)", icon: "📏", hint: "Kilograms, kilometers" },
    { value: "imperial", label: "Imperial (lb)", icon: "📐", hint: "Pounds, miles" },
];
const UnitToggle = ({ preference, onChange }) => (_jsxs("div", { className: "theme-toggle", role: "group", "aria-label": "Unit selection", children: [_jsxs("div", { className: "theme-toggle__header", children: [_jsxs("span", { className: "theme-toggle__title", children: [_jsx("span", { "aria-hidden": "true", children: "\u2696\uFE0F" }), " Units"] }), _jsxs("span", { className: "theme-toggle__hint", children: [preference === "metric" ? "Metric" : "Imperial", " preferred"] })] }), _jsx("div", { className: "theme-toggle__choices", children: OPTIONS.map((option) => (_jsxs("button", { type: "button", className: `theme-toggle__chip ${preference === option.value ? "is-active" : ""}`, "aria-pressed": preference === option.value, onClick: () => onChange(option.value), children: [_jsx("span", { className: "theme-toggle__icon", "aria-hidden": "true", children: option.icon }), _jsxs("span", { children: [option.label, _jsx("small", { className: "theme-toggle__micro-hint", children: option.hint })] })] }, option.value))) })] }));
export default UnitToggle;
