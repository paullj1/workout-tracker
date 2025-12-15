import { FormEvent, useMemo, useState } from "react";
import type { Template, TemplatePayload, TemplateUpdate } from "../lib/api";

type Props = {
  templates: Template[];
  onCreate: (payload: TemplatePayload) => void;
  onUpdate: (payload: TemplateUpdate) => void;
  onDelete: (id: string) => void;
  isSubmitting?: boolean;
  isUpdating?: boolean;
};

const blankExercise = () => ({ name: "", target_sets: 3, target_reps: 8, rest_seconds: 90 });

const TemplateBuilder = ({ templates, onCreate, onUpdate, onDelete, isSubmitting = false, isUpdating = false }: Props) => {
  const [draft, setDraft] = useState<TemplatePayload>({ name: "", notes: "", exercises: [blankExercise()] });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);

  const canSave = useMemo(
    () => Boolean(draft.name.trim()) && draft.exercises.length > 0 && draft.exercises.every((ex) => ex.name.trim()),
    [draft],
  );

  const updateExercise = (
    index: number,
    key: "name" | "target_sets" | "target_reps" | "rest_seconds",
    value: string,
  ) => {
    setDraft((prev) => {
      const copy = [...prev.exercises];
      copy[index] = {
        ...copy[index],
        [key]: key === "name" ? value : Number(value),
      };
      return { ...prev, exercises: copy };
    });
  };

  const addExercise = () => setDraft((prev) => ({ ...prev, exercises: [...prev.exercises, blankExercise()] }));

  const removeExercise = (index: number) =>
    setDraft((prev) => ({ ...prev, exercises: prev.exercises.filter((_, idx) => idx !== index) }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    if (editingId) {
      onUpdate({ ...draft, id: editingId });
    } else {
      onCreate(draft);
    }
    setDraft({ name: "", notes: "", exercises: [blankExercise()] });
    setEditingId(null);
    setCloningId(null);
  };

  const startEdit = (template: Template) => {
    setEditingId(template.id);
    setDraft({
      name: template.name,
      notes: template.notes ?? "",
      exercises: template.exercises.map((exercise) => ({
        name: exercise.name,
        target_sets: exercise.target_sets,
        target_reps: exercise.target_reps,
        rest_seconds: exercise.rest_seconds ?? 0,
      })),
    });
  };

  const startClone = (template: Template) => {
    setEditingId(null);
    setCloningId(template.id);
    setDraft({
      name: `${template.name} copy`,
      notes: template.notes ?? "",
      exercises: template.exercises.map((exercise) => ({
        name: exercise.name,
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

  return (
    <div className="card">
      <div className="card__header">
        <div>
          <h2>🧭 Template Builder</h2>
          <p className="card__hint">Define exercises, targets, and reuse them anytime.</p>
        </div>
        <span className="pill">{templates.length} saved</span>
      </div>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          Template name
          <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
        </label>
        <label>
          Notes (optional)
          <textarea
            rows={2}
            value={draft.notes ?? ""}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
          />
        </label>
          <div className="section-heading">
            <h3>
              Exercises{" "}
              {(editingId || cloningId) && <small>{editingId ? "(editing)" : cloningId ? "(cloning)" : ""}</small>}
            </h3>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {(editingId || cloningId) && (
                <button type="button" className="ghost" onClick={cancelEdit}>
                  Cancel
                </button>
              )}
              <button type="button" onClick={addExercise}>
                ➕ Add Exercise
              </button>
            </div>
          </div>
        {draft.exercises.map((exercise, index) => (
          <div key={`exercise-${index}`} className="template-row">
            <input
              placeholder="Exercise"
              value={exercise.name}
              onChange={(event) => updateExercise(index, "name", event.target.value)}
              required
            />
            <label className="inline-label">
              Sets
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={exercise.target_sets}
                onChange={(event) => updateExercise(index, "target_sets", event.target.value)}
              />
            </label>
            <label className="inline-label">
              Reps
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={exercise.target_reps}
                onChange={(event) => updateExercise(index, "target_reps", event.target.value)}
              />
            </label>
            <label className="inline-label">
              Rest (sec)
              <input
                type="number"
                min={0}
                value={exercise.rest_seconds ?? 0}
                onChange={(event) => updateExercise(index, "rest_seconds", event.target.value)}
              />
            </label>
            {draft.exercises.length > 1 && (
              <button type="button" className="ghost" onClick={() => removeExercise(index)} aria-label="Remove exercise">
                🗑️
              </button>
            )}
          </div>
        ))}
        <button type="submit" disabled={!canSave || isSubmitting || isUpdating}>
          {editingId
            ? isUpdating
              ? "Updating..."
              : "Update template"
            : cloningId
              ? isSubmitting
                ? "Cloning..."
                : "Save clone"
              : isSubmitting
                ? "Saving..."
                : "Save template"}
        </button>
      </form>

      {templates.length > 0 && (
        <div className="template-list">
          <div className="section-heading">
            <h3>Saved templates</h3>
            <small>Tap start in the workout card to use one.</small>
          </div>
          <div className="template-grid">
            {templates.map((template) => (
              <div key={template.id} className="template-card">
                <div className="template-card__header">
                  <div>
                    <p className="template-card__eyebrow">{template.exercises.length} exercises</p>
                    <h4>{template.name}</h4>
                  </div>
                  <div style={{ display: "flex", gap: "0.35rem" }}>
                    <button className="ghost" type="button" onClick={() => startEdit(template)} aria-label="Edit template">
                      ✏️
                    </button>
                    <button className="ghost" type="button" onClick={() => startClone(template)} aria-label="Clone template">
                      📄
                    </button>
                    <button className="ghost" onClick={() => onDelete(template.id)} aria-label="Delete template">
                      🗑️
                    </button>
                  </div>
                </div>
                {template.notes && <p className="template-card__notes">{template.notes}</p>}
                <ul className="template-card__list">
                  {template.exercises.map((exercise, idx) => (
                    <li key={`${template.id}-ex-${idx}`}>
                      {exercise.name}: {exercise.target_sets} x {exercise.target_reps} • Rest {exercise.rest_seconds ?? 0}s
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateBuilder;
