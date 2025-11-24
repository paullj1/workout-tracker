import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { useMemo } from "react";
import { fromKgToPreference, preferredWeightUnit } from "../lib/units";
const TrendChart = ({ data, unitPreference }) => {
    const preferredUnit = useMemo(() => preferredWeightUnit(unitPreference), [unitPreference]);
    const convertedData = useMemo(() => data.map((point) => ({
        ...point,
        tonnage: Math.round(fromKgToPreference(point.tonnage, unitPreference) * 10) / 10,
        average_body_weight: point.average_body_weight === null || point.average_body_weight === undefined
            ? null
            : Math.round(fromKgToPreference(point.average_body_weight, unitPreference) * 10) / 10,
    })), [data, unitPreference]);
    const tooltipFormatter = (value, name) => {
        if (name.startsWith("Tonnage") || name.startsWith("Avg Body Weight")) {
            const rounded = Math.round(value * 10) / 10;
            return [`${rounded} ${preferredUnit}`, name];
        }
        return [value, name];
    };
    return (_jsxs("div", { className: "card card--chart", children: [_jsxs("div", { className: "card__header", children: [_jsx("h2", { children: "\uD83D\uDCC8 Trend Overview" }), _jsx("p", { className: "card__hint", children: "Volume, reps, and body weight over time." })] }), convertedData.length === 0 ? (_jsx("p", { children: "We need at least one workout to graph trends." })) : (_jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(LineChart, { data: convertedData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "date" }), _jsx(YAxis, { yAxisId: "left" }), _jsx(YAxis, { yAxisId: "right", orientation: "right" }), _jsx(Tooltip, { formatter: tooltipFormatter }), _jsx(Legend, {}), _jsx(Line, { type: "monotone", dataKey: "total_sets", stroke: "#3b82f6", yAxisId: "left", name: "Sets" }), _jsx(Line, { type: "monotone", dataKey: "total_reps", stroke: "#10b981", yAxisId: "left", name: "Reps" }), _jsx(Line, { type: "monotone", dataKey: "tonnage", stroke: "#f97316", yAxisId: "left", name: `Tonnage (${preferredUnit})` }), _jsx(Line, { type: "monotone", dataKey: "average_body_weight", stroke: "#6366f1", yAxisId: "right", name: `Avg Body Weight (${preferredUnit})` })] }) }))] }));
};
export default TrendChart;
