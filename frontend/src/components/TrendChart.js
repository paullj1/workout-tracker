import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
import { useEffect, useMemo, useState } from "react";
import { fromKgToPreference, preferredWeightUnit } from "../lib/units";
const TrendChart = ({ data, unitPreference }) => {
    const preferredUnit = useMemo(() => preferredWeightUnit(unitPreference), [unitPreference]);
    const weightLabel = (kg) => `${Math.round(fromKgToPreference(kg, unitPreference) * 10) / 10} ${preferredUnit}`;
    const dateLabel = (value) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const overviewData = useMemo(() => (data?.overview ?? []).map((point) => ({
        dateLabel: dateLabel(point.date),
        total_sets: point.total_sets,
        total_reps: point.total_reps,
        tonnage: Math.round(fromKgToPreference(point.tonnage_kg, unitPreference) * 10) / 10,
        average_body_weight: point.average_body_weight_kg === null || point.average_body_weight_kg === undefined
            ? null
            : Math.round(fromKgToPreference(point.average_body_weight_kg, unitPreference) * 10) / 10,
        duration_minutes: point.duration_minutes === null || point.duration_minutes === undefined ? null : Math.round(point.duration_minutes * 10) / 10,
    })), [data, unitPreference]);
    const bodyWeightData = useMemo(() => (data?.body_weight ?? []).map((point) => ({
        dateLabel: dateLabel(point.date),
        average_body_weight: Math.round(fromKgToPreference(point.average_body_weight_kg, unitPreference) * 10) / 10,
    })), [data, unitPreference]);
    const durationData = useMemo(() => (data?.durations ?? []).map((point) => ({
        dateLabel: dateLabel(point.date),
        minutes: Math.round(point.duration_minutes * 10) / 10,
    })), [data]);
    const exerciseTotals = useMemo(() => {
        const totals = new Map();
        (data?.exercise_volume ?? []).forEach((point) => {
            const current = totals.get(point.exercise) ?? { tonnage_kg: 0, total_reps: 0 };
            totals.set(point.exercise, {
                tonnage_kg: current.tonnage_kg + point.tonnage_kg,
                total_reps: current.total_reps + point.total_reps,
            });
        });
        return Array.from(totals.entries())
            .map(([exercise, metrics]) => ({ exercise, ...metrics }))
            .sort((a, b) => b.tonnage_kg - a.tonnage_kg || b.total_reps - a.total_reps);
    }, [data]);
    const [activeExercise, setActiveExercise] = useState(null);
    useEffect(() => {
        if (exerciseTotals.length === 0) {
            setActiveExercise(null);
            return;
        }
        setActiveExercise((current) => {
            if (current && exerciseTotals.some((entry) => entry.exercise === current)) {
                return current;
            }
            return exerciseTotals[0].exercise;
        });
    }, [exerciseTotals]);
    const exerciseSeries = useMemo(() => {
        if (!activeExercise)
            return [];
        return (data?.exercise_volume ?? [])
            .filter((point) => point.exercise === activeExercise)
            .map((point) => {
            const timestamp = new Date(point.date).getTime();
            return {
                dateValue: timestamp,
                dateLabel: dateLabel(point.date),
                tonnage: Math.round(fromKgToPreference(point.tonnage_kg, unitPreference) * 10) / 10,
                total_sets: point.total_sets,
                total_reps: point.total_reps,
            };
        })
            .sort((a, b) => a.dateValue - b.dateValue);
    }, [activeExercise, data, unitPreference]);
    const hasAnyData = (data?.overview?.length ?? 0) > 0 ||
        (data?.body_weight?.length ?? 0) > 0 ||
        (data?.durations?.length ?? 0) > 0 ||
        (data?.exercise_volume?.length ?? 0) > 0;
    if (!hasAnyData) {
        return (_jsxs("div", { className: "card card--chart", children: [_jsxs("div", { className: "card__header", children: [_jsx("h2", { children: "\uD83D\uDCC8 Trend Overview" }), _jsx("p", { className: "card__hint", children: "Volume, time, and body weight over time." })] }), _jsx("p", { children: "Log a workout to start seeing your personal trends." })] }));
    }
    const overviewTooltip = (value, name) => {
        if (name.includes("Weight") || name.includes("Tonnage")) {
            return [`${value} ${preferredUnit}`, name];
        }
        if (name.includes("Duration")) {
            return [`${value} min`, name];
        }
        return [value, name];
    };
    return (_jsxs("div", { className: "layout-grid", children: [_jsxs("div", { className: "card card--chart", children: [_jsx("div", { className: "card__header", children: _jsxs("div", { children: [_jsx("h2", { children: "\uD83D\uDCCA Daily Overview" }), _jsx("p", { className: "card__hint", children: "Sets, reps, tonnage, and session length by day." })] }) }), _jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(LineChart, { data: overviewData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "dateLabel" }), _jsx(YAxis, { yAxisId: "left" }), _jsx(YAxis, { yAxisId: "right", orientation: "right" }), _jsx(Tooltip, { formatter: overviewTooltip }), _jsx(Legend, {}), _jsx(Line, { type: "monotone", dataKey: "total_sets", stroke: "#3b82f6", yAxisId: "left", name: "Sets" }), _jsx(Line, { type: "monotone", dataKey: "total_reps", stroke: "#10b981", yAxisId: "left", name: "Reps" }), _jsx(Line, { type: "monotone", dataKey: "tonnage", stroke: "#f97316", yAxisId: "right", name: `Tonnage (${preferredUnit})` }), _jsx(Line, { type: "monotone", dataKey: "duration_minutes", stroke: "#8b5cf6", yAxisId: "right", name: "Workout Duration (min)" })] }) })] }), _jsxs("div", { className: "card card--chart", children: [_jsx("div", { className: "card__header", children: _jsxs("div", { children: [_jsx("h2", { children: "\uD83D\uDD52 Workout Time" }), _jsx("p", { className: "card__hint", children: "How long each session lasted." })] }) }), durationData.length === 0 ? (_jsx("p", { children: "Wrap up workouts to track time spent." })) : (_jsx(ResponsiveContainer, { width: "100%", height: 220, children: _jsxs(BarChart, { data: durationData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "dateLabel" }), _jsx(YAxis, {}), _jsx(Tooltip, { formatter: (value) => [`${value} min`, "Duration"] }), _jsx(Legend, {}), _jsx(Bar, { dataKey: "minutes", fill: "#8b5cf6", name: "Minutes", radius: [8, 8, 0, 0] })] }) }))] }), _jsxs("div", { className: "card card--chart", children: [_jsx("div", { className: "card__header", children: _jsxs("div", { children: [_jsx("h2", { children: "\u2696\uFE0F Body Weight" }), _jsx("p", { className: "card__hint", children: "Average body weight captured per day." })] }) }), bodyWeightData.length === 0 ? (_jsx("p", { children: "Add body weight when saving a workout to see this trend." })) : (_jsx(ResponsiveContainer, { width: "100%", height: 220, children: _jsxs(AreaChart, { data: bodyWeightData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "dateLabel" }), _jsx(YAxis, {}), _jsx(Tooltip, { formatter: (value) => [`${value} ${preferredUnit}`, "Average"] }), _jsx(Legend, {}), _jsx(Area, { type: "monotone", dataKey: "average_body_weight", stroke: "#6366f1", fill: "#6366f1", fillOpacity: 0.15, name: `Body Weight (${preferredUnit})` })] }) }))] }), _jsxs("div", { className: "card card--chart", children: [_jsxs("div", { className: "card__header", children: [_jsxs("div", { children: [_jsx("h2", { children: "\uD83C\uDFCB\uFE0F Exercise Volume" }), _jsx("p", { className: "card__hint", children: "Weight moved per exercise across sessions." })] }), _jsx("div", { style: { display: "flex", gap: "0.5rem", flexWrap: "wrap" }, children: exerciseTotals.slice(0, 5).map((entry) => {
                                    const isActive = activeExercise === entry.exercise;
                                    return (_jsxs("button", { type: "button", className: `pill${isActive ? "" : " pill--muted"}`, onClick: () => setActiveExercise(entry.exercise), "aria-pressed": isActive, children: [entry.exercise, " \u2022 ", entry.tonnage_kg > 0 ? weightLabel(entry.tonnage_kg) : `${entry.total_reps} reps`] }, entry.exercise));
                                }) })] }), exerciseSeries.length === 0 ? (_jsx("p", { children: "Log sets with weights to break down volume by exercise." })) : (_jsx(ResponsiveContainer, { width: "100%", height: 240, children: _jsxs(AreaChart, { data: exerciseSeries, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "dateLabel" }), _jsx(YAxis, {}), _jsx(Tooltip, { formatter: (value, name) => {
                                        if (name === "tonnage")
                                            return [`${value} ${preferredUnit}`, "Tonnage"];
                                        return [value, name === "total_sets" ? "Sets" : "Reps"];
                                    } }), _jsx(Legend, {}), _jsx(Area, { type: "monotone", dataKey: "tonnage", stroke: "#f59e0b", fill: "#f59e0b", fillOpacity: 0.18, name: `Tonnage (${preferredUnit})` }), _jsx(Line, { type: "monotone", dataKey: "total_sets", stroke: "#3b82f6", name: "Sets" }), _jsx(Line, { type: "monotone", dataKey: "total_reps", stroke: "#10b981", name: "Reps" })] }) }))] })] }));
};
export default TrendChart;
