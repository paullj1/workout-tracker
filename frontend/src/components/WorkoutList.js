import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { format } from "date-fns";
import { displayWeight } from "../lib/units";
const formatAggregatedSets = (workout, unitPreference) => {
    const groups = new Map();
    workout.sets.forEach((set) => {
        const setType = set.exercise_type ?? "weighted";
        const modifier = setType === "bodyweight" && set.weight !== null && set.weight !== undefined && Number.isFinite(set.weight)
            ? Math.round(set.weight * 10) / 10
            : null;
        const weightLabel = setType === "bodyweight"
            ? modifier
                ? `${set.reps} reps (+${modifier} mod)`
                : `${set.reps} reps`
            : `${set.reps}x${displayWeight(set.weight, set.unit, unitPreference)}`;
        const entry = weightLabel;
        const list = groups.get(set.exercise) ?? [];
        list.push(entry);
        groups.set(set.exercise, list);
    });
    const lines = [];
    groups.forEach((entries, exercise) => {
        lines.push(`${exercise}: ${entries.join(", ")}`);
    });
    return lines;
};
const WorkoutList = ({ workouts, unitPreference, onDelete }) => (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "card__header", children: [_jsx("h2", { children: "\uD83D\uDCD3 Recent Workouts" }), _jsx("p", { className: "card__hint", children: "Swipe through your latest lifts." })] }), workouts.length === 0 && _jsx("p", { children: "No workouts logged yet." }), _jsx("div", { className: "workout-list", children: workouts.map((workout) => (_jsxs("div", { className: "workout-card", children: [_jsxs("div", { className: "workout-card__header", children: [_jsxs("div", { children: [_jsx("p", { className: "workout-card__eyebrow", children: format(new Date(workout.start_time), "PPpp") }), _jsx("h3", { className: "workout-card__title", children: workout.title })] }), _jsx("button", { className: "ghost", onClick: () => onDelete(workout.id), "aria-label": "Delete workout", children: "\uD83D\uDDD1\uFE0F" })] }), workout.notes && _jsx("p", { className: "workout-card__notes", children: workout.notes }), _jsx("div", { className: "chip-row chip-row--stacked", children: formatAggregatedSets(workout, unitPreference).map((line, index) => (_jsxs("span", { className: "pill pill--muted", children: ["\uD83D\uDCAA ", line] }, `${workout.id}-agg-${index}`))) })] }, workout.id))) })] }));
export default WorkoutList;
