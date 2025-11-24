import { FormEvent, useMemo, useState } from "react";
import type { WorkoutPayload, WorkoutSet } from "../lib/api";
import { fromKgToPreference, preferredWeightUnit, toKgFromPreference } from "../lib/units";
import type { UnitSystem } from "../types/units";

type Props = {
  onSubmit: (payload: WorkoutPayload) => void;
  unitPreference: UnitSystem;
};

const createBlankSet = (unit: WorkoutSet["unit"]): WorkoutSet => ({
  exercise: "",
  reps: 0,
  unit,
});

const WorkoutForm = ({ onSubmit, unitPreference }: Props) => {
  const [payload, setPayload] = useState<WorkoutPayload>({
    title: "Training Session",
    start_time: new Date().toISOString(),
    end_time: new Date().toISOString(),
    body_weight_timing: "before",
    sets: [],
  });

  const preferredUnit = useMemo(() => preferredWeightUnit(unitPreference), [unitPreference]);
  const formattedBodyWeight = useMemo(() => {
    if (payload.body_weight === null || payload.body_weight === undefined) return "";
    return Math.round(fromKgToPreference(payload.body_weight, unitPreference) * 10) / 10;
  }, [payload.body_weight, unitPreference]);

  const addSet = () => {
    setPayload((prev) => ({ ...prev, sets: [...prev.sets, createBlankSet(preferredUnit)] }));
  };

  const updateSet = (index: number, key: keyof WorkoutSet, value: string) => {
    setPayload((prev) => {
      const copy = [...prev.sets];
      copy[index] = {
        ...copy[index],
        [key]:
          key === "reps"
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

  const removeSet = (index: number) => {
    setPayload((prev) => {
      const copy = prev.sets.filter((_, idx) => idx !== index);
      return { ...prev, sets: copy };
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(payload);
    setPayload((prev) => ({ ...prev, notes: "", sets: [] }));
  };

  return (
    <div className="card">
      <div className="card__header">
        <h2>📝 Log Workout</h2>
        <p className="card__hint">Keep your log fresh with new sets and notes.</p>
      </div>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          Title
          <input
            value={payload.title}
            onChange={(event) => setPayload({ ...payload, title: event.target.value })}
            required
          />
        </label>
        <div className="form-grid">
          <label>
            Start
            <input
              type="datetime-local"
              value={payload.start_time.slice(0, 16)}
              onChange={(event) =>
                setPayload({ ...payload, start_time: new Date(event.target.value).toISOString() })
              }
            />
          </label>
          <label>
            End
            <input
              type="datetime-local"
              value={payload.end_time?.slice(0, 16) ?? ""}
              onChange={(event) =>
                setPayload({
                  ...payload,
                  end_time: event.target.value ? new Date(event.target.value).toISOString() : null,
                })
              }
            />
          </label>
        </div>
        <label>
          Body Weight ({preferredUnit})
          <input
            type="number"
            min={0}
            value={formattedBodyWeight}
            onChange={(event) =>
              setPayload({
                ...payload,
                body_weight: event.target.value ? toKgFromPreference(Number(event.target.value), unitPreference) : null,
              })
            }
          />
        </label>
        <label>
          Notes
          <textarea
            rows={3}
            value={payload.notes ?? ""}
            onChange={(event) => setPayload({ ...payload, notes: event.target.value })}
          />
        </label>
        <div>
          <div className="section-heading">
            <h3>Sets</h3>
            <button type="button" onClick={addSet}>
              ➕ Add Set
            </button>
          </div>
          {payload.sets.length === 0 && <p>No sets yet.</p>}
          {payload.sets.map((set, idx) => (
            <div key={`set-${idx}`} className="set-row">
              <input
                placeholder="Exercise"
                value={set.exercise}
                onChange={(event) => updateSet(idx, "exercise", event.target.value)}
              />
              <input
                type="number"
                placeholder="Reps"
                value={set.reps}
                onChange={(event) => updateSet(idx, "reps", event.target.value)}
              />
              <input
                type="number"
                placeholder="Weight"
                value={set.weight ?? ""}
                onChange={(event) => updateSet(idx, "weight", event.target.value)}
              />
              <select value={set.unit} onChange={(event) => updateSet(idx, "unit", event.target.value)}>
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </select>
              <button type="button" className="ghost" onClick={() => removeSet(idx)}>
                🗑️
              </button>
            </div>
          ))}
        </div>
        <button type="submit">Save Workout</button>
      </form>
    </div>
  );
};

export default WorkoutForm;
