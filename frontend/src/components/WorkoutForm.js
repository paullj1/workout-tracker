import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { fromKgToPreference, preferredWeightUnit, toKgFromPreference } from "../lib/units";
const createBlankSet = (unit) => ({
    exercise: "",
    reps: 0,
    unit,
});
const WorkoutForm = ({ onSubmit, unitPreference }) => {
    const [payload, setPayload] = useState({
        title: "Training Session",
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        body_weight_timing: "before",
        sets: [],
    });
    const preferredUnit = useMemo(() => preferredWeightUnit(unitPreference), [unitPreference]);
    const formattedBodyWeight = useMemo(() => {
        if (payload.body_weight === null || payload.body_weight === undefined)
            return "";
        return Math.round(fromKgToPreference(payload.body_weight, unitPreference) * 10) / 10;
    }, [payload.body_weight, unitPreference]);
    const addSet = () => {
        setPayload((prev) => ({ ...prev, sets: [...prev.sets, createBlankSet(preferredUnit)] }));
    };
    const updateSet = (index, key, value) => {
        setPayload((prev) => {
            const copy = [...prev.sets];
            copy[index] = {
                ...copy[index],
                [key]: key === "reps"
                    ? Number(value)
                    : key === "weight"
                        ? value
                            ? Number(value)
                            : null
                        : value,
            };
            return { ...prev, sets: copy };
        });
    };
    const removeSet = (index) => {
        setPayload((prev) => {
            const copy = prev.sets.filter((_, idx) => idx !== index);
            return { ...prev, sets: copy };
        });
    };
    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            await Promise.resolve(onSubmit(payload));
            setPayload((prev) => ({ ...prev, notes: "", sets: [] }));
        }
        catch {
            // Keep the user's input so they can fix validation issues.
        }
    };
    return (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "card__header", children: [_jsx("h2", { children: "\uD83D\uDCDD Log Workout" }), _jsx("p", { className: "card__hint", children: "Keep your log fresh with new sets and notes." })] }), _jsxs("form", { className: "form", onSubmit: handleSubmit, children: [_jsxs("label", { children: ["Title", _jsx("input", { value: payload.title, onChange: (event) => setPayload({ ...payload, title: event.target.value }), required: true })] }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { children: ["Start", _jsx("input", { type: "datetime-local", value: payload.start_time.slice(0, 16), onChange: (event) => setPayload({ ...payload, start_time: new Date(event.target.value).toISOString() }) })] }), _jsxs("label", { children: ["End", _jsx("input", { type: "datetime-local", value: payload.end_time?.slice(0, 16) ?? "", onChange: (event) => setPayload({
                                            ...payload,
                                            end_time: event.target.value ? new Date(event.target.value).toISOString() : null,
                                        }) })] })] }), _jsxs("label", { children: ["Body Weight (", preferredUnit, ")", _jsx("input", { type: "number", min: 0, inputMode: "numeric", value: formattedBodyWeight, onChange: (event) => setPayload({
                                    ...payload,
                                    body_weight: event.target.value ? toKgFromPreference(Number(event.target.value), unitPreference) : null,
                                }), onFocus: (event) => event.currentTarget.select() })] }), _jsxs("label", { children: ["Notes", _jsx("textarea", { rows: 3, value: payload.notes ?? "", onChange: (event) => setPayload({ ...payload, notes: event.target.value }) })] }), _jsxs("div", { children: [_jsxs("div", { className: "section-heading", children: [_jsx("h3", { children: "Sets" }), _jsx("button", { type: "button", onClick: addSet, children: "\u2795 Add Set" })] }), payload.sets.length === 0 && _jsx("p", { children: "No sets yet." }), payload.sets.map((set, idx) => (_jsxs("div", { className: "set-row", children: [_jsx("input", { placeholder: "Exercise", value: set.exercise, onChange: (event) => updateSet(idx, "exercise", event.target.value) }), _jsx("input", { type: "number", placeholder: "Reps", inputMode: "numeric", value: set.reps, onChange: (event) => updateSet(idx, "reps", event.target.value), onFocus: (event) => event.currentTarget.select() }), _jsx("input", { type: "number", placeholder: "Weight", inputMode: "numeric", value: set.weight ?? "", onChange: (event) => updateSet(idx, "weight", event.target.value), onFocus: (event) => event.currentTarget.select() }), _jsxs("select", { value: set.unit, onChange: (event) => updateSet(idx, "unit", event.target.value), children: [_jsx("option", { value: "kg", children: "kg" }), _jsx("option", { value: "lb", children: "lb" })] }), _jsx("button", { type: "button", className: "ghost", onClick: () => removeSet(idx), children: "\uD83D\uDDD1\uFE0F" })] }, `set-${idx}`)))] }), _jsx("button", { type: "submit", children: "Save Workout" })] })] }));
};
export default WorkoutForm;
