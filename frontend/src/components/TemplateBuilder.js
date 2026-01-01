import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
const blankExercise = () => ({ name: "", exercise_type: "weighted", target_sets: 3, target_reps: 8, rest_seconds: 90 });
const TemplateBuilder = ({ templates, onCreate, onUpdate, onDelete, isSubmitting = false, isUpdating = false }) => {
    const [draft, setDraft] = useState({ name: "", notes: "", exercises: [blankExercise()] });
    const [editingId, setEditingId] = useState(null);
    const [cloningId, setCloningId] = useState(null);
    const canSave = useMemo(() => Boolean(draft.name.trim()) && draft.exercises.length > 0 && draft.exercises.every((ex) => ex.name.trim()), [draft]);
    const updateExercise = (index, key, value) => {
        setDraft((prev) => {
            const copy = [...prev.exercises];
            copy[index] = {
                ...copy[index],
                [key]: key === "name" || key === "exercise_type" ? value : Number(value),
            };
            return { ...prev, exercises: copy };
        });
    };
    const addExercise = () => setDraft((prev) => ({ ...prev, exercises: [...prev.exercises, blankExercise()] }));
    const removeExercise = (index) => setDraft((prev) => ({ ...prev, exercises: prev.exercises.filter((_, idx) => idx !== index) }));
    const handleSubmit = (event) => {
        event.preventDefault();
        if (!canSave)
            return;
        if (editingId) {
            onUpdate({ ...draft, id: editingId });
        }
        else {
            onCreate(draft);
        }
        setDraft({ name: "", notes: "", exercises: [blankExercise()] });
        setEditingId(null);
        setCloningId(null);
    };
    const startEdit = (template) => {
        setEditingId(template.id);
        setDraft({
            name: template.name,
            notes: template.notes ?? "",
            exercises: template.exercises.map((exercise) => ({
                name: exercise.name,
                exercise_type: exercise.exercise_type ?? "weighted",
                target_sets: exercise.target_sets,
                target_reps: exercise.target_reps,
                rest_seconds: exercise.rest_seconds ?? 0,
            })),
        });
    };
    const startClone = (template) => {
        setEditingId(null);
        setCloningId(template.id);
        setDraft({
            name: `${template.name} copy`,
            notes: template.notes ?? "",
            exercises: template.exercises.map((exercise) => ({
                name: exercise.name,
                exercise_type: exercise.exercise_type ?? "weighted",
                target_sets: exercise.target_sets,
                target_reps: exercise.target_reps,
                rest_seconds: exercise.rest_seconds ?? 0,
            })),
        });
    };
    const cancelEdit = () => {
        setEditingId(null);
        setCloningId(null);
        setDraft({ name: "", notes: "", exercises: [blankExercise()] });
    };
            return (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "card__header", children: [_jsxs("div", { children: [_jsx("h2", { children: "\uD83E\uDDED Template Builder" }), _jsx("p", { className: "card__hint", children: "Define exercises, targets, and reuse them anytime." })] }), _jsxs("span", { className: "pill", children: [templates.length, " saved"] })] }), _jsxs("form", { className: "form", onSubmit: handleSubmit, children: [_jsxs("label", { children: ["Template name", _jsx("input", { value: draft.name, onChange: (event) => setDraft({ ...draft, name: event.target.value }), required: true })] }), _jsxs("label", { children: ["Notes (optional)", _jsx("textarea", { rows: 2, value: draft.notes ?? "", onChange: (event) => setDraft({ ...draft, notes: event.target.value }) })] }), _jsxs("div", { className: "section-heading", children: [_jsxs("h3", { children: ["Exercises", " ", (editingId || cloningId) && _jsx("small", { children: editingId ? "(editing)" : cloningId ? "(cloning)" : "" })] }), _jsxs("div", { style: { display: "flex", gap: "0.5rem", flexWrap: "wrap" }, children: [(editingId || cloningId) && (_jsx("button", { type: "button", className: "ghost", onClick: cancelEdit, children: "Cancel" })), _jsx("button", { type: "button", onClick: addExercise, children: "\u2795 Add Exercise" })] })] }), draft.exercises.map((exercise, index) => (_jsxs("div", { className: "template-row", children: [_jsx("input", { placeholder: "Exercise", value: exercise.name, onChange: (event) => updateExercise(index, "name", event.target.value), required: true }), _jsxs("label", { className: "inline-label", children: ["Type", _jsxs("select", { value: exercise.exercise_type ?? "weighted", onChange: (event) => updateExercise(index, "exercise_type", event.target.value), children: [_jsx("option", { value: "weighted", children: "Weighted" }), _jsx("option", { value: "bodyweight", children: "Body weight" })] })] }), _jsxs("label", { className: "inline-label", children: ["Sets", _jsx("input", { type: "number", min: 1, inputMode: "numeric", value: exercise.target_sets, onChange: (event) => updateExercise(index, "target_sets", event.target.value) })] }), _jsxs("label", { className: "inline-label", children: ["Reps", _jsx("input", { type: "number", min: 0, inputMode: "numeric", value: exercise.target_reps, onChange: (event) => updateExercise(index, "target_reps", event.target.value) })] }), _jsxs("label", { className: "inline-label", children: ["Rest (sec)", _jsx("input", { type: "number", min: 0, value: exercise.rest_seconds ?? 0, onChange: (event) => updateExercise(index, "rest_seconds", event.target.value) })] }), draft.exercises.length > 1 && (_jsx("button", { type: "button", className: "ghost", onClick: () => removeExercise(index), "aria-label": "Remove exercise", children: "\uD83D\uDDD1\uFE0F" }))] }, `exercise-${index}`))), _jsx("button", { type: "submit", disabled: !canSave || isSubmitting || isUpdating, children: editingId
                            ? isUpdating
                                ? "Updating..."
                                : "Update template"
                            : cloningId
                                ? isSubmitting
                                    ? "Cloning..."
                                    : "Save clone"
                                : isSubmitting
                                    ? "Saving..."
                                    : "Save template" })] }), templates.length > 0 && (_jsxs("div", { className: "template-list", children: [_jsxs("div", { className: "section-heading", children: [_jsx("h3", { children: "Saved templates" }), _jsx("small", { children: "Tap start in the workout card to use one." })] }), _jsx("div", { className: "template-grid", children: templates.map((template) => (_jsxs("div", { className: "template-card", children: [_jsxs("div", { className: "template-card__header", children: [_jsxs("div", { children: [_jsxs("p", { className: "template-card__eyebrow", children: [template.exercises.length, " exercises"] }), _jsx("h4", { children: template.name })] }), _jsxs("div", { style: { display: "flex", gap: "0.35rem" }, children: [_jsx("button", { className: "ghost", type: "button", onClick: () => startEdit(template), "aria-label": "Edit template", children: "\u270F\uFE0F" }), _jsx("button", { className: "ghost", type: "button", onClick: () => startClone(template), "aria-label": "Clone template", children: "\uD83D\uDCC4" }), _jsx("button", { className: "ghost", onClick: () => onDelete(template.id), "aria-label": "Delete template", children: "\uD83D\uDDD1\uFE0F" })] })] }), template.notes && _jsx("p", { className: "template-card__notes", children: template.notes }), _jsx("ul", { className: "template-card__list", children: template.exercises.map((exercise, idx) => (_jsxs("li", { children: [exercise.name, ": ", exercise.target_sets, " x ", exercise.target_reps, " \u2022 ", exercise.exercise_type === "bodyweight" ? "Body weight" : "Weighted", " \u2022 Rest ", exercise.rest_seconds ?? 0, "s"] }, `${template.id}-ex-${idx}`))) })] }, template.id))) })] }))] }));
};
export default TemplateBuilder;
