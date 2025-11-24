import { useCallback, useEffect, useMemo, useState } from "react";
import type { Template, WorkoutPayload, WorkoutSet } from "../lib/api";
import { displayWeight, preferredWeightUnit, toKgFromPreference } from "../lib/units";
import type { UnitSystem } from "../types/units";

type Slide =
  | { key: "overview"; type: "overview" }
  | { key: string; type: "exercise"; index: number }
  | { key: "finish"; type: "finish" };

type Props = {
  templates: Template[];
  onSave: (payload: WorkoutPayload) => void;
  unitPreference: UnitSystem;
  userId?: string;
  onTimerUpdate?: (elapsedMs: number | null) => void;
  onLiveContextChange?: (context: {
    isActive: boolean;
    exerciseName: string | null;
    setNumber: number | null;
    totalSets: number | null;
    restMs: number | null;
  }) => void;
};

const formatClock = (ms: number | null) => {
  if (ms === null) return "--:--";
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
};

type PersistedWorkoutState = {
  selectedTemplateId: string;
  activeSlide: number;
  startTime: string | null;
  endTime: string | null;
  restAnchor: string | null;
  restMs: number;
  notes: string;
  loggedSets: WorkoutSet[];
  setForm: { reps: number; weight: string };
  bodyWeight: string;
};

const STORAGE_KEY_PREFIX = "guided-workout-state";
const getStorageKey = (userId?: string) => `${STORAGE_KEY_PREFIX}-${userId ?? "anon"}`;

const loadPersistedState = (storageKey: string): PersistedWorkoutState | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedWorkoutState;
  } catch {
    return null;
  }
};

const clearPersistedState = (storageKey: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
};

const GuidedWorkout = ({ templates, onSave, unitPreference, userId, onTimerUpdate, onLiveContextChange }: Props) => {
  const preferredUnit = useMemo(() => preferredWeightUnit(unitPreference), [unitPreference]);
  const storageKey = useMemo(() => getStorageKey(userId), [userId]);
  const persisted = useMemo(() => loadPersistedState(storageKey), [storageKey]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => persisted?.selectedTemplateId ?? "");
  const [activeSlide, setActiveSlide] = useState(() => persisted?.activeSlide ?? 0);
  const [startTime, setStartTime] = useState<Date | null>(() =>
    persisted?.startTime ? new Date(persisted.startTime) : null,
  );
  const [endTime, setEndTime] = useState<Date | null>(() => (persisted?.endTime ? new Date(persisted.endTime) : null));
  const [elapsedMs, setElapsedMs] = useState(() =>
    persisted?.startTime ? Date.now() - new Date(persisted.startTime).getTime() : 0,
  );
  const [restAnchor, setRestAnchor] = useState<Date | null>(() =>
    persisted?.restAnchor ? new Date(persisted.restAnchor) : null,
  );
  const [restMs, setRestMs] = useState(() => {
    if (persisted?.restAnchor) {
      return Date.now() - new Date(persisted.restAnchor).getTime();
    }
    return persisted?.restMs ?? 0;
  });
  const [notes, setNotes] = useState(persisted?.notes ?? "");
  const [loggedSets, setLoggedSets] = useState<WorkoutSet[]>(persisted?.loggedSets ?? []);
  const [setForm, setSetForm] = useState<{ reps: number; weight: string }>(() => persisted?.setForm ?? { reps: 0, weight: "" });
  const [bodyWeight, setBodyWeight] = useState(persisted?.bodyWeight ?? "");
  const [error, setError] = useState<string | null>(null);

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  const exerciseSlides = activeTemplate?.exercises ?? [];
  const slides = useMemo<Slide[]>(() => {
    if (!activeTemplate || exerciseSlides.length === 0) {
      return [{ key: "overview", type: "overview" }];
    }
    return [
      { key: "overview", type: "overview" },
      ...exerciseSlides.map((_, index) => ({
        key: `${activeTemplate.id}-exercise-${index}`,
        type: "exercise" as const,
        index,
      })),
      { key: "finish", type: "finish" },
    ];
  }, [activeTemplate, exerciseSlides]);
  const slideMeta = slides[activeSlide];
  const currentExerciseIndex =
    slideMeta?.type === "exercise"
      ? slideMeta.index
      : slideMeta?.type === "finish"
        ? Math.max(0, exerciseSlides.length - 1)
        : 0;
  const currentExercise = exerciseSlides[currentExerciseIndex] ?? null;
  const nextExercise = exerciseSlides[currentExerciseIndex + 1] ?? null;
  const currentExerciseSets = useMemo(
    () => loggedSets.filter((set) => (currentExercise ? set.exercise === currentExercise.name : false)),
    [loggedSets, currentExercise],
  );
  const hasStarted = Boolean(startTime);
  const isActive = Boolean(startTime && !endTime);
  const hasPrev = activeSlide > 0;
  const hasNext = activeSlide < slides.length - 1;
  const exerciseTotal = exerciseSlides.length;
  const currentSetNumber = currentExerciseSets.length + 1;
  const restDurationMs = (currentExercise?.rest_seconds ?? 0) * 1000;
  const restRemainingMs = restDurationMs > 0 ? Math.max(0, restDurationMs - restMs) : restMs;
  const restRemainingPercent =
    restDurationMs > 0 ? Math.min(100, Math.max(0, (restRemainingMs / restDurationMs) * 100)) : 0;
  const restUsedPercent = restDurationMs > 0 ? 100 - restRemainingPercent : 0;
  const isRestExpired = restDurationMs > 0 && restRemainingMs <= 0 && isActive;

  const workoutHistory = useMemo(() => {
    const groups = new Map<string, WorkoutSet[]>();
    loggedSets.forEach((set) => {
      const list = groups.get(set.exercise) ?? [];
      list.push(set);
      groups.set(set.exercise, list);
    });
    return Array.from(groups.entries()).map(([exercise, sets]) => ({ exercise, sets }));
  }, [loggedSets]);

  const setProgress = useMemo(() => {
    const counts = new Map<string, number>();
    loggedSets.forEach((set) => counts.set(set.exercise, (counts.get(set.exercise) ?? 0) + 1));
    return counts;
  }, [loggedSets]);

  const resetSession = useCallback(() => {
    setStartTime(null);
    setEndTime(null);
    setElapsedMs(0);
    setRestAnchor(null);
    setRestMs(0);
    setLoggedSets([]);
    setNotes("");
    setBodyWeight("");
    setSetForm({ reps: 0, weight: "" });
    setActiveSlide(0);
    setError(null);
    onTimerUpdate?.(null);
    clearPersistedState(storageKey);
  }, [onTimerUpdate, storageKey]);

  useEffect(() => {
    const found = templates.find((template) => template.id === selectedTemplateId);
    if (!found && templates.length > 0) {
      setSelectedTemplateId(templates[0].id);
    }
    if (templates.length === 0 && selectedTemplateId) {
      setSelectedTemplateId("");
    }
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (!activeTemplate) {
      if (selectedTemplateId && templates.length === 0) return;
      resetSession();
      return;
    }
    if (startTime) return;
    setActiveSlide(0);
    if (activeTemplate.exercises.length > 0) {
      const first = activeTemplate.exercises[0];
      setSetForm({
        reps: first.target_reps ?? 0,
        weight: "",
      });
    }
  }, [activeTemplate, resetSession, selectedTemplateId, startTime, templates.length]);

  useEffect(() => {
    if (!activeTemplate) return;
    const slideCount = slides.length;
    if (activeSlide > slideCount - 1) {
      setActiveSlide(Math.max(0, slideCount - 1));
    }
  }, [slides.length, activeSlide, activeTemplate]);

  useEffect(() => {
    if (!startTime) {
      setElapsedMs(0);
      onTimerUpdate?.(null);
      return;
    }
    if (endTime) {
      const elapsed = endTime.getTime() - startTime.getTime();
      setElapsedMs(elapsed);
      onTimerUpdate?.(elapsed);
      return;
    }
    const tick = () => {
      const elapsed = Date.now() - startTime.getTime();
      setElapsedMs(elapsed);
      onTimerUpdate?.(elapsed);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime, endTime, onTimerUpdate]);

  useEffect(() => {
    if (!restAnchor || !isActive) {
      setRestMs(0);
      return;
    }
    const tick = () => setRestMs(Date.now() - restAnchor.getTime());
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [restAnchor, isActive]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const shouldPersist =
      startTime ||
      loggedSets.length > 0 ||
      notes ||
      bodyWeight ||
      activeSlide > 0 ||
      restAnchor ||
      selectedTemplateId;
    if (!shouldPersist) {
      clearPersistedState(storageKey);
      return;
    }
    const payload: PersistedWorkoutState = {
      selectedTemplateId,
      activeSlide,
      startTime: startTime ? startTime.toISOString() : null,
      endTime: endTime ? endTime.toISOString() : null,
      restAnchor: restAnchor ? restAnchor.toISOString() : null,
      restMs,
      notes,
      loggedSets,
      setForm,
      bodyWeight,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [
    activeSlide,
    bodyWeight,
    endTime,
    loggedSets,
    notes,
    restAnchor,
    restMs,
    selectedTemplateId,
    setForm,
    startTime,
    storageKey,
  ]);

  useEffect(() => {
    if (!onLiveContextChange) return;
    if (!isActive) {
      onLiveContextChange({
        isActive: false,
        exerciseName: null,
        setNumber: null,
        totalSets: null,
        restMs: null,
      });
      return;
    }
    onLiveContextChange({
      isActive: true,
      exerciseName: currentExercise?.name ?? null,
      setNumber: currentExercise ? currentSetNumber : null,
      totalSets: currentExercise?.target_sets ?? null,
      restMs: restDurationMs > 0 ? restRemainingMs : restMs,
    });
  }, [onLiveContextChange, isActive, currentExercise, currentSetNumber, restMs, restDurationMs, restRemainingMs]);

  useEffect(
    () => () => {
      onLiveContextChange?.({
        isActive: false,
        exerciseName: null,
        setNumber: null,
        totalSets: null,
        restMs: null,
      });
    },
    [onLiveContextChange],
  );

  useEffect(() => {
    if (!currentExercise) return;
    setSetForm({
      reps: currentExercise.target_reps ?? 0,
      weight: "",
    });
  }, [currentExercise?.name, currentExercise?.target_reps]);

  const handleStart = () => {
    if (templates.length === 0) {
      setError("Create a template first.");
      return;
    }
    if (!activeTemplate) {
      setError("Pick a template to start your workout.");
      return;
    }
    if (exerciseSlides.length === 0) {
      setError("Templates need at least one exercise.");
      return;
    }
    setError(null);
    setStartTime(new Date());
    setEndTime(null);
    setLoggedSets([]);
    setNotes("");
    setBodyWeight("");
    setRestAnchor(new Date());
    setRestMs(0);
    setActiveSlide(1);
  };

  const handleAddSet = () => {
    if (!startTime) {
      setError("Start the workout before logging sets.");
      return;
    }
    if (endTime) {
      setError("Workout is already finishing.");
      return;
    }
    if (!currentExercise) {
      setError("No exercise selected.");
      return;
    }
    setError(null);
    const next: WorkoutSet = {
      exercise: currentExercise.name,
      reps: Number(setForm.reps),
      unit: preferredUnit,
      weight: setForm.weight !== "" ? Number(setForm.weight) : null,
    };
    setLoggedSets((prev) => [...prev, next]);
    setSetForm((prev) => ({ ...prev, weight: "" }));
    setRestAnchor(new Date());
    const targetSets = currentExercise.target_sets ?? 0;
    const newCount = currentExerciseSets.length + 1;
    if (targetSets > 0 && newCount >= targetSets && hasNext) {
      setActiveSlide((prev) => Math.min(slides.length - 1, prev + 1));
      setRestAnchor(new Date());
    }
  };

  const handleFinish = () => {
    if (!startTime) {
      setError("Start a workout before finishing.");
      return;
    }
    if (loggedSets.length === 0) {
      setError("Log at least one set before finishing.");
      return;
    }
    const confirmed = window.confirm("Wrap up and save this workout?");
    if (!confirmed) return;
    const finishAt = new Date();
    setEndTime(finishAt);
    setRestAnchor(null);
    const payload: WorkoutPayload = {
      title: activeTemplate ? `${activeTemplate.name} Session` : "Workout",
      start_time: startTime.toISOString(),
      end_time: finishAt.toISOString(),
      template_id: activeTemplate?.id ?? null,
      body_weight: bodyWeight !== "" ? toKgFromPreference(Number(bodyWeight), unitPreference) : null,
      body_weight_timing: "after",
      notes,
      sets: loggedSets,
    };
    onSave(payload);
    resetSession();
  };

  const handleAbort = () => {
    const hasProgress = startTime || loggedSets.length > 0 || notes || bodyWeight;
    if (hasProgress) {
      const confirmed = window.confirm("Abort this workout? All logged sets will be lost.");
      if (!confirmed) return;
    }
    resetSession();
  };

  const handlePrev = () => {
    if (!hasPrev) return;
    setActiveSlide((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    if (!hasNext) return;
    setError(null);
    setActiveSlide((prev) => Math.min(slides.length - 1, prev + 1));
    setRestAnchor(new Date());
    setRestMs(0);
  };

  const canStart = templates.length > 0 && Boolean(activeTemplate) && exerciseSlides.length > 0;
  const wrapNextLabel = activeSlide === slides.length - 2 ? "Wrap up" : "Next";
  const canAbort = hasStarted || loggedSets.length > 0 || notes || bodyWeight;

  return (
    <div className="card card--mobile guided-card">
      <div className="card__header guided__header">
        <div>
          <h2>🎯 Workout Guide</h2>
          <p className="card__hint">Move through your workout one card at a time.</p>
        </div>
        <div className="timer-stack">
          <div className={`timer-chip timer-chip--muted${isRestExpired ? " timer-chip--expired" : ""}`} aria-label="Rest timer">
            <p>Rest</p>
            <div className="rest-chip">
              <div
                className="rest-chip__ring"
                style={{
                  background: restDurationMs
                    ? `conic-gradient(var(--border-color) 0% ${restUsedPercent}%, var(--button-bg) ${restUsedPercent}% 100%)`
                    : "var(--chip-bg)",
                }}
              >
                <span className="rest-chip__ring-center">{formatClock(isActive ? restRemainingMs : null)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <small style={{ color: "var(--danger)" }}>{error}</small>}

      <div className="guided-wizard">
        <div className="guided-wizard__progress" aria-hidden="true">
          {slides.map((slide, idx) => {
            const isActiveStep = idx === activeSlide;
            const isComplete = idx < activeSlide;
            return (
              <span
                key={slide.key}
                className={`guided-wizard__dot${isActiveStep ? " is-active" : ""}${isComplete ? " is-complete" : ""}`}
              />
            );
          })}
        </div>

        <div className="guided-wizard__viewport">
          <div className="guided-wizard__track" style={{ transform: `translateX(-${activeSlide * 100}%)` }}>
            {slides.map((slide) => {
              if (slide.type === "overview") {
                return (
                  <section key={slide.key} className="guided-wizard__slide">
                    <div className="section-heading">
                      <div>
                        <p className="exercise-card__eyebrow">Step 1</p>
                        <h3>Pick a template</h3>
                        <p className="card__hint">Choose your plan and preview the flow before you start.</p>
                      </div>
                      <button type="button" onClick={handleStart} disabled={!canStart}>
                        {startTime ? "Restart" : "Start workout"}
                      </button>
                    </div>
                    <div className="guided-form">
                      <label>
                        Template
                        <select
                          className="select select--pill select--modern"
                          value={selectedTemplateId}
                          onChange={(event) => setSelectedTemplateId(event.target.value)}
                          aria-label="Select template"
                        >
                          <option value="">Select a template</option>
                          {templates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {activeTemplate?.notes && <p className="card__hint">{activeTemplate.notes}</p>}
                    </div>
                    {templates.length === 0 && (
                      <div className="callout">
                        <strong>No templates yet.</strong> Visit the Templates tab to create one before starting a workout.
                      </div>
                    )}
                    {activeTemplate ? (
                      <div className="template-card template-card--overview">
                        <div className="template-card__header">
                          <div>
                            <p className="template-card__eyebrow">Overview</p>
                            <h4>{activeTemplate.name}</h4>
                          </div>
                          <small>{activeTemplate.exercises.length} exercises</small>
                        </div>
                        <ul className="template-card__list template-card__list--inline">
                          {activeTemplate.exercises.map((exercise, idx) => (
                            <li key={`${activeTemplate.id}-exercise-${idx}`}>
                              <strong>{exercise.name}</strong>: {exercise.target_sets} × {exercise.target_reps} reps
                              {exercise.rest_seconds ? ` • ${exercise.rest_seconds}s rest` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="card__hint">Pick a template to see the play-by-play.</p>
                    )}
                  </section>
                );
              }

              if (slide.type === "exercise" && currentExercise) {
                const isCurrent = slide.index === currentExerciseIndex;
                return (
                  <section key={slide.key} className="guided-wizard__slide">
                    {isCurrent && (
                      <>
                        <div className="exercise-stage__header">
                          <div className="exercise-stage__meta">
                            <p className="exercise-card__eyebrow">
                              Exercise {currentExerciseIndex + 1} of {exerciseTotal}
                            </p>
                            <div className="exercise-stage__status">
                              {isActive && <span className="pill">Set {currentSetNumber}</span>}
                            </div>
                          </div>
                          <h3 className="exercise-card__title">{currentExercise.name}</h3>
                          <p className="card__hint">
                            Target: {currentExercise.target_sets} sets × {currentExercise.target_reps} reps •{" "}
                            {currentExercise.rest_seconds ? `${currentExercise.rest_seconds}s rest` : "Rest as needed"}
                          </p>
                          <small className="exercise-card__next">
                            Next: {nextExercise ? nextExercise.name : "Wrap up"}
                          </small>
                        </div>
                        <div className="exercise-stage__body">
                          <div className="exercise-stage__history">
                            {currentExerciseSets.length === 0 ? (
                              <p className="card__hint">No sets logged for this exercise yet.</p>
                              ) : (
                              currentExerciseSets.map((set, idx) => (
                                <div key={`current-set-${idx}`} className="set-table__row">
                                  <span className="set-table__cell">Set {idx + 1}</span>
                                  <span className="set-table__cell">{set.reps} reps</span>
                                  <span className="set-table__cell">
                                    {displayWeight(set.weight, set.unit, unitPreference)}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                          <div
                            className="set-row set-row--inline exercise-stage__form"
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                handleAddSet();
                              }
                            }}
                          >
                            <div className="set-row__title">
                              <h3>Log this set</h3>
                              <small>{hasStarted ? "Save every set as you go" : "Start the workout to log"}</small>
                            </div>
                            <input
                              type="number"
                              min={0}
                              value={setForm.reps}
                              onChange={(event) => setSetForm({ ...setForm, reps: Number(event.target.value) })}
                              placeholder="Reps"
                              disabled={!activeTemplate || !isActive}
                            />
                            <input
                              type="number"
                              min={0}
                              value={setForm.weight}
                              onChange={(event) => setSetForm({ ...setForm, weight: event.target.value })}
                              placeholder={`Weight (${preferredUnit})`}
                              disabled={!activeTemplate || !isActive}
                            />
                            <button type="button" onClick={handleAddSet} disabled={!activeTemplate || !isActive}>
                              ⏎
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                    <div className="guided-wizard__nav">
                      <button type="button" className="ghost" onClick={handlePrev} disabled={!hasPrev}>
                        ← Back
                      </button>
                      <div className="guided-wizard__nav-status" />
                      <button type="button" onClick={handleNext} disabled={!hasNext}>
                        {wrapNextLabel} →
                      </button>
                    </div>
                  </section>
                );
              }

              if (slide.type === "finish") {
                return (
                  <section key={slide.key} className="guided-wizard__slide">
                    <div className="section-heading">
                      <div>
                        <p className="exercise-card__eyebrow">Step {slides.length}</p>
                        <h3>Wrap up</h3>
                        <p className="card__hint">Capture notes and body weight before saving.</p>
                      </div>
                    </div>
                    <div className="guided-summary">
                      <div className="guided-summary__item">
                        <p className="card__hint">Elapsed</p>
                        <strong>{formatClock(startTime ? elapsedMs : null)}</strong>
                      </div>
                      <div className="guided-summary__item">
                        <p className="card__hint">Sets logged</p>
                        <strong>{loggedSets.length}</strong>
                      </div>
                      <div className="guided-summary__item">
                        <p className="card__hint">Template</p>
                        <strong>{activeTemplate?.name ?? "—"}</strong>
                      </div>
                    </div>
                    <div className="form-grid">
                      <label>
                        Session notes
                        <textarea
                          rows={3}
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          placeholder="Energy, PRs, anything worth remembering."
                        />
                      </label>
                      <label>
                        Body weight ({preferredUnit})
                        <input
                          type="number"
                          min={0}
                          value={bodyWeight}
                          onChange={(event) => setBodyWeight(event.target.value)}
                        />
                      </label>
                    </div>
                    <div className="guided-wizard__nav">
                      <button type="button" className="ghost" onClick={handlePrev} disabled={!hasPrev}>
                        ← Back
                      </button>
                      <div className="guided-wizard__nav-status">
                        <small>Slide {activeSlide + 1} of {slides.length}</small>
                      </div>
                      <button
                        type="button"
                        className="ghost ghost--danger ghost--small"
                        onClick={handleAbort}
                        disabled={!canAbort}
                      >
                        🛑 Abort
                      </button>
                    </div>
                    <button
                      type="button"
                      className={`finish-button${isRestExpired ? " finish-button--alert" : ""}`}
                      onClick={handleFinish}
                      disabled={!startTime || Boolean(endTime)}
                    >
                      🏁 Finish
                    </button>
                  </section>
                );
              }

              return null;
            })}
          </div>
        </div>
      </div>

      <div className="card card--subdued history-card">
        <div className="section-heading">
          <h3>Session log</h3>
          <small>{loggedSets.length} sets</small>
        </div>
        {workoutHistory.length === 0 ? (
          <p className="card__hint">Sets you log will stack up here.</p>
        ) : (
          <ul className="history-list">
            {workoutHistory.map((entry) => (
              <li key={entry.exercise} className="history-item">
                <div className="history-item__header">
                  <strong>{entry.exercise}</strong>
                  <small>{entry.sets.length} sets</small>
                </div>
                <div className="history-item__sets">
                  {entry.sets.map((set, idx) => (
                    <span key={`${entry.exercise}-${idx}`} className="pill pill--muted">
                      Set {idx + 1}: {set.reps} reps @ {displayWeight(set.weight, set.unit, unitPreference)}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default GuidedWorkout;
