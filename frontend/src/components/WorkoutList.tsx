import { format } from "date-fns";
import type { Workout } from "../lib/api";
import { displayWeight } from "../lib/units";
import type { UnitSystem } from "../types/units";

type Props = {
  workouts: Workout[];
  unitPreference: UnitSystem;
  onDelete: (id: string) => void;
};

const formatAggregatedSets = (workout: Workout, unitPreference: UnitSystem): string[] => {
  const groups = new Map<string, string[]>();
  workout.sets.forEach((set) => {
    const setType = set.exercise_type ?? "weighted";
    const modifier =
      setType === "bodyweight" && set.weight !== null && set.weight !== undefined && Number.isFinite(set.weight)
        ? Math.round(set.weight * 10) / 10
        : null;
    const weightLabel =
      setType === "bodyweight"
        ? modifier
          ? `${set.reps} reps (+${modifier} mod)`
          : `${set.reps} reps`
        : `${set.reps}x${displayWeight(set.weight, set.unit, unitPreference)}`;
    const entry = weightLabel;
    const list = groups.get(set.exercise) ?? [];
    list.push(entry);
    groups.set(set.exercise, list);
  });
  const lines: string[] = [];
  groups.forEach((entries, exercise) => {
    lines.push(`${exercise}: ${entries.join(", ")}`);
  });
  return lines;
};

const WorkoutList = ({ workouts, unitPreference, onDelete }: Props) => (
  <div className="card">
    <div className="card__header">
      <h2>📓 Recent Workouts</h2>
      <p className="card__hint">Swipe through your latest lifts.</p>
    </div>
    {workouts.length === 0 && <p>No workouts logged yet.</p>}
    <div className="workout-list">
      {workouts.map((workout) => (
        <div key={workout.id} className="workout-card">
          <div className="workout-card__header">
            <div>
              <p className="workout-card__eyebrow">{format(new Date(workout.start_time), "PPpp")}</p>
              <h3 className="workout-card__title">{workout.title}</h3>
            </div>
            <button className="ghost" onClick={() => onDelete(workout.id)} aria-label="Delete workout">
              🗑️
            </button>
          </div>
          {workout.notes && <p className="workout-card__notes">{workout.notes}</p>}
          <div className="chip-row chip-row--stacked">
            {formatAggregatedSets(workout, unitPreference).map((line, index) => (
              <span key={`${workout.id}-agg-${index}`} className="pill pill--muted">
                💪 {line}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default WorkoutList;
