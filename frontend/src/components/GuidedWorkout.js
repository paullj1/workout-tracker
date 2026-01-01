import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { displayWeight, preferredWeightUnit, toKgFromPreference } from "../lib/units";
const formatClock = (ms) => {
    if (ms === null)
        return "--:--";
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (value) => value.toString().padStart(2, "0");
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
};
const formatModifier = (value) => {
    if (value === null || value === undefined || value === 0 || !Number.isFinite(value))
        return null;
    const rounded = Math.round(value * 10) / 10;
    return `${rounded}`;
};
const STORAGE_KEY_PREFIX = "guided-workout-state";
const getStorageKey = (userId) => `${STORAGE_KEY_PREFIX}-${userId ?? "anon"}`;
const loadPersistedState = (storageKey) => {
    if (typeof window === "undefined")
        return null;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
};
const clearPersistedState = (storageKey) => {
    if (typeof window === "undefined")
        return;
    window.localStorage.removeItem(storageKey);
};
const GuidedWorkout = ({ templates, workouts, onSave, unitPreference, userId, onTimerUpdate, onLiveContextChange, }) => {
    const preferredUnit = useMemo(() => preferredWeightUnit(unitPreference), [unitPreference]);
    const storageKey = useMemo(() => getStorageKey(userId), [userId]);
    const persisted = useMemo(() => loadPersistedState(storageKey), [storageKey]);
    const [selectedTemplateId, setSelectedTemplateId] = useState(() => persisted?.selectedTemplateId ?? "");
    const [activeSlide, setActiveSlide] = useState(() => persisted?.activeSlide ?? 0);
    const [startTime, setStartTime] = useState(() => persisted?.startTime ? new Date(persisted.startTime) : null);
    const [endTime, setEndTime] = useState(() => (persisted?.endTime ? new Date(persisted.endTime) : null));
    const [elapsedMs, setElapsedMs] = useState(() => persisted?.startTime ? Date.now() - new Date(persisted.startTime).getTime() : 0);
    const [restAnchor, setRestAnchor] = useState(() => persisted?.restAnchor ? new Date(persisted.restAnchor) : null);
    const [restMs, setRestMs] = useState(() => {
        if (persisted?.restAnchor) {
            return Date.now() - new Date(persisted.restAnchor).getTime();
        }
        return persisted?.restMs ?? 0;
    });
    const [notes, setNotes] = useState(persisted?.notes ?? "");
    const [loggedSets, setLoggedSets] = useState(persisted?.loggedSets ?? []);
    const [setForm, setSetForm] = useState(() => persisted?.setForm ?? { reps: 0, weight: "" });
    const [bodyWeight, setBodyWeight] = useState(persisted?.bodyWeight ?? "");
    const [error, setError] = useState(null);
    const [editingSet, setEditingSet] = useState(null);
    const audioContextRef = useRef(null);
    const restAlertedRef = useRef(false);
    const activeTemplate = useMemo(() => templates.find((template) => template.id === selectedTemplateId) ?? null, [selectedTemplateId, templates]);
    const exerciseSlides = activeTemplate?.exercises ?? [];
    const slides = useMemo(() => {
        if (!activeTemplate || exerciseSlides.length === 0) {
            return [{ key: "overview", type: "overview" }];
        }
        return [
            { key: "overview", type: "overview" },
            ...exerciseSlides.map((_, index) => ({
                key: `${activeTemplate.id}-exercise-${index}`,
                type: "exercise",
                index,
            })),
            { key: "finish", type: "finish" },
        ];
    }, [activeTemplate, exerciseSlides]);
    const slideMeta = slides[activeSlide];
    const currentExerciseIndex = slideMeta?.type === "exercise"
        ? slideMeta.index
        : slideMeta?.type === "finish"
            ? Math.max(0, exerciseSlides.length - 1)
            : 0;
    const currentExercise = exerciseSlides[currentExerciseIndex] ?? null;
    const currentExerciseType = currentExercise?.exercise_type ?? "weighted";
    const nextExercise = exerciseSlides[currentExerciseIndex + 1] ?? null;
    const currentExerciseSets = useMemo(() => loggedSets.filter((set) => (currentExercise ? set.exercise === currentExercise.name : false)), [loggedSets, currentExercise]);
    const latestExerciseSets = useMemo(() => {
        const sorted = [...workouts].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
        const latest = new Map();
        sorted.forEach((workout) => {
            const grouped = new Map();
            workout.sets.forEach((set) => {
                const list = grouped.get(set.exercise) ?? [];
                list.push(set);
                grouped.set(set.exercise, list);
            });
            grouped.forEach((sets, exercise) => {
                if (!latest.has(exercise)) {
                    latest.set(exercise, sets);
                }
            });
        });
        return latest;
    }, [workouts]);
    const previousExerciseSets = useMemo(() => {
        if (!currentExercise)
            return [];
        return latestExerciseSets.get(currentExercise.name) ?? [];
    }, [currentExercise, latestExerciseSets]);
    const lastSetSuggestion = useMemo(() => {
        if (!currentExercise)
            return null;
        const priorSets = latestExerciseSets.get(currentExercise.name);
        if (!priorSets || priorSets.length === 0)
            return null;
        const prior = priorSets[currentExerciseSets.length]; // current set index (0-based)
        if (!prior)
            return null;
        return {
            reps: prior.reps,
            modifier: currentExerciseType === "bodyweight" ? prior.weight ?? null : null,
            weight: currentExerciseType === "bodyweight" || prior.weight === null || prior.weight === undefined
                ? null
                : displayWeight(prior.weight, prior.unit, unitPreference),
        };
    }, [currentExercise, currentExerciseSets.length, currentExerciseType, latestExerciseSets, unitPreference]);
    const hasStarted = Boolean(startTime);
    const isActive = Boolean(startTime && !endTime);
    const hasPrev = activeSlide > 0;
    const hasNext = activeSlide < slides.length - 1;
    const exerciseTotal = exerciseSlides.length;
    const currentSetNumber = currentExerciseSets.length + 1;
    const restDurationMs = (currentExercise?.rest_seconds ?? 0) * 1000;
    const restRemainingMs = restDurationMs > 0 ? Math.max(0, restDurationMs - restMs) : restMs;
    const restRemainingPercent = restDurationMs > 0 ? Math.min(100, Math.max(0, (restRemainingMs / restDurationMs) * 100)) : 0;
    const restUsedPercent = restDurationMs > 0 ? 100 - restRemainingPercent : 0;
    const isRestExpired = restDurationMs > 0 && restRemainingMs <= 0 && isActive;
    const formatSetWeight = (set) => {
        const setType = set.exercise_type ?? "weighted";
        if (setType === "bodyweight") {
            const modifier = formatModifier(set.weight);
            return modifier ? `+${modifier} mod reps` : "Body weight";
        }
        return displayWeight(set.weight, set.unit, unitPreference);
    };
    const ensureAudioContext = useCallback(() => {
        if (typeof window === "undefined")
            return;
        const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
        if (!AudioContextClass)
            return;
        if (!audioContextRef.current || audioContextRef.current.state === "closed") {
            audioContextRef.current = new AudioContextClass();
        }
        const ctx = audioContextRef.current;
        if (ctx.state === "suspended") {
            ctx.resume();
        }
    }, []);
    const playRestAlert = useCallback(() => {
        ensureAudioContext();
        const ctx = audioContextRef.current;
        if (!ctx)
            return;
        const now = ctx.currentTime;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, now);
        oscillator.frequency.exponentialRampToValueAtTime(440, now + 0.15);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.3);
    }, [ensureAudioContext]);
    const ensureNotificationPermission = useCallback(() => {
        if (typeof window === "undefined" || !("Notification" in window))
            return;
        if (Notification.permission === "default") {
            Notification.requestPermission().catch(() => undefined);
        }
    }, []);
    const notifyRestComplete = useCallback(() => {
        if (typeof window === "undefined" || !("Notification" in window))
            return;
        if (Notification.permission !== "granted")
            return;
        const body = currentExercise?.name
            ? `Rest complete for ${currentExercise.name}.`
            : "Rest complete. Ready for the next set.";
        new Notification("Rest timer done", { body });
    }, [currentExercise?.name]);
    const workoutHistory = useMemo(() => {
        const groups = new Map();
        loggedSets.forEach((set, index) => {
            const list = groups.get(set.exercise) ?? [];
            list.push({ set, index });
            groups.set(set.exercise, list);
        });
        return Array.from(groups.entries()).map(([exercise, sets]) => ({ exercise, sets }));
    }, [loggedSets]);
    const setProgress = useMemo(() => {
        const counts = new Map();
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
        setEditingSet(null);
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
            if (selectedTemplateId && templates.length === 0)
                return;
            resetSession();
            return;
        }
        if (startTime)
            return;
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
        if (!activeTemplate)
            return;
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
        if (isRestExpired && !restAlertedRef.current) {
            restAlertedRef.current = true;
            playRestAlert();
            notifyRestComplete();
            return;
        }
        if (!isRestExpired) {
            restAlertedRef.current = false;
        }
    }, [isRestExpired, notifyRestComplete, playRestAlert]);
    useEffect(() => () => {
        audioContextRef.current?.close();
    }, []);
    useEffect(() => {
        if (typeof window === "undefined")
            return;
        const shouldPersist = startTime ||
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
        const payload = {
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
        if (!onLiveContextChange)
            return;
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
    useEffect(() => () => {
        onLiveContextChange?.({
            isActive: false,
            exerciseName: null,
            setNumber: null,
            totalSets: null,
            restMs: null,
        });
    }, [onLiveContextChange]);
    useEffect(() => {
        if (!currentExercise)
            return;
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
        ensureNotificationPermission();
        ensureAudioContext();
        setStartTime(new Date());
        setEndTime(null);
        setLoggedSets([]);
        setNotes("");
        setBodyWeight("");
        setEditingSet(null);
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
        ensureAudioContext();
        const next = {
            exercise: currentExercise.name,
            exercise_type: currentExerciseType,
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
    const handleFinish = async () => {
        if (!startTime) {
            setError("Start a workout before finishing.");
            return;
        }
        if (loggedSets.length === 0) {
            setError("Log at least one set before finishing.");
            return;
        }
        const confirmed = window.confirm("Wrap up and save this workout?");
        if (!confirmed)
            return;
        const finishAt = new Date();
        const payload = {
            title: activeTemplate ? `${activeTemplate.name} Session` : "Workout",
            start_time: startTime.toISOString(),
            end_time: finishAt.toISOString(),
            template_id: activeTemplate?.id ?? null,
            body_weight: bodyWeight !== "" ? toKgFromPreference(Number(bodyWeight), unitPreference) : null,
            body_weight_timing: "after",
            notes,
            sets: loggedSets,
        };
        try {
            await Promise.resolve(onSave(payload));
            setEndTime(finishAt);
            setRestAnchor(null);
            resetSession();
        }
        catch {
            setError("Saving workout failed. Please review the entries and try again.");
        }
    };
    const handleAbort = () => {
        const hasProgress = startTime || loggedSets.length > 0 || notes || bodyWeight;
        if (hasProgress) {
            const confirmed = window.confirm("Abort this workout? All logged sets will be lost.");
            if (!confirmed)
                return;
        }
        resetSession();
    };
    const handlePrev = () => {
        if (!hasPrev)
            return;
        setActiveSlide((prev) => Math.max(0, prev - 1));
    };
    const handleNext = () => {
        if (!hasNext)
            return;
        setError(null);
        setActiveSlide((prev) => Math.min(slides.length - 1, prev + 1));
        setRestAnchor(new Date());
        setRestMs(0);
    };
    const handleEditSet = (index) => {
        const target = loggedSets[index];
        if (!target)
            return;
        setError(null);
        setEditingSet({
            index,
            reps: target.reps,
            weight: target.weight === null || target.weight === undefined ? "" : String(target.weight),
        });
    };
    const handleEditSubmit = (event) => {
        event?.preventDefault();
        if (!editingSet)
            return;
        const repsValue = Number(editingSet.reps);
        const weightValue = editingSet.weight === "" ? null : Number(editingSet.weight);
        if (!Number.isFinite(repsValue)) {
            setError("Reps must be a valid number.");
            return;
        }
        if (weightValue !== null && !Number.isFinite(weightValue)) {
            setError("Weight must be a valid number.");
            return;
        }
        setLoggedSets((prev) => prev.map((set, idx) => idx === editingSet.index
            ? {
                ...set,
                reps: Math.max(0, repsValue),
                weight: weightValue,
            }
            : set));
        setEditingSet(null);
    };
    const handleCancelEdit = () => {
        setEditingSet(null);
    };
    const canStart = templates.length > 0 && Boolean(activeTemplate) && exerciseSlides.length > 0;
    const wrapNextLabel = activeSlide === slides.length - 2 ? "Wrap up" : "Next";
    const canAbort = hasStarted || loggedSets.length > 0 || notes || bodyWeight;
    return (_jsxs("div", { className: "card card--mobile guided-card", children: [_jsxs("div", { className: "card__header guided__header", children: [_jsxs("div", { children: [_jsx("h2", { children: "\uD83C\uDFAF Workout Guide" }), _jsx("p", { className: "card__hint", children: "Move through your workout one card at a time." })] }), _jsx("div", { className: "timer-stack", children: _jsxs("div", { className: `timer-chip timer-chip--muted${isRestExpired ? " timer-chip--expired" : ""}`, "aria-label": "Rest timer", children: [_jsx("p", { children: "Rest" }), _jsx("div", { className: "rest-chip", children: _jsx("div", { className: "rest-chip__ring", style: {
                                            background: restDurationMs
                                                ? `conic-gradient(var(--border-color) 0% ${restUsedPercent}%, var(--button-bg) ${restUsedPercent}% 100%)`
                                                : "var(--chip-bg)",
                                        }, children: _jsx("span", { className: "rest-chip__ring-center", children: formatClock(isActive ? restRemainingMs : null) }) }) })] }) })] }), error && _jsx("small", { style: { color: "var(--danger)" }, children: error }), _jsxs("div", { className: "guided-wizard", children: [_jsx("div", { className: "guided-wizard__progress", "aria-hidden": "true", children: slides.map((slide, idx) => {
                            const isActiveStep = idx === activeSlide;
                            const isComplete = idx < activeSlide;
                            return (_jsx("span", { className: `guided-wizard__dot${isActiveStep ? " is-active" : ""}${isComplete ? " is-complete" : ""}` }, slide.key));
                        }) }), _jsx("div", { className: "guided-wizard__viewport", children: _jsx("div", { className: "guided-wizard__track", style: { transform: `translateX(-${activeSlide * 100}%)` }, children: slides.map((slide) => {
                                if (slide.type === "overview") {
                                    return (_jsxs("section", { className: "guided-wizard__slide", children: [_jsxs("div", { className: "section-heading", children: [_jsxs("div", { children: [_jsx("p", { className: "exercise-card__eyebrow", children: "Step 1" }), _jsx("h3", { children: "Pick a template" }), _jsx("p", { className: "card__hint", children: "Choose your plan and preview the flow before you start." })] }), _jsx("button", { type: "button", onClick: handleStart, disabled: !canStart, children: startTime ? "Restart" : "Start workout" })] }), _jsxs("div", { className: "guided-form", children: [_jsxs("label", { children: ["Template", _jsxs("select", { className: "select select--pill select--modern", value: selectedTemplateId, onChange: (event) => setSelectedTemplateId(event.target.value), "aria-label": "Select template", children: [_jsx("option", { value: "", children: "Select a template" }), templates.map((template) => (_jsx("option", { value: template.id, children: template.name }, template.id)))] })] }), activeTemplate?.notes && _jsx("p", { className: "card__hint", children: activeTemplate.notes })] }), templates.length === 0 && (_jsxs("div", { className: "callout", children: [_jsx("strong", { children: "No templates yet." }), " Visit the Templates tab to create one before starting a workout."] })), activeTemplate ? (_jsxs("div", { className: "template-card template-card--overview", children: [_jsxs("div", { className: "template-card__header", children: [_jsxs("div", { children: [_jsx("p", { className: "template-card__eyebrow", children: "Overview" }), _jsx("h4", { children: activeTemplate.name })] }), _jsxs("small", { children: [activeTemplate.exercises.length, " exercises"] })] }), _jsx("ul", { className: "template-card__list template-card__list--inline", children: activeTemplate.exercises.map((exercise, idx) => (_jsxs("li", { children: [_jsx("strong", { children: exercise.name }), ": ", exercise.target_sets, " \u00D7 ", exercise.target_reps, " reps", exercise.rest_seconds ? ` • ${exercise.rest_seconds}s rest` : ""] }, `${activeTemplate.id}-exercise-${idx}`))) })] })) : (_jsx("p", { className: "card__hint", children: "Pick a template to see the play-by-play." }))] }, slide.key));
                                }
                                if (slide.type === "exercise" && currentExercise) {
                                    const isCurrent = slide.index === currentExerciseIndex;
                                    return (_jsxs("section", { className: "guided-wizard__slide", children: [isCurrent && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "exercise-stage__header", children: [_jsxs("div", { className: "exercise-stage__meta", children: [_jsxs("p", { className: "exercise-card__eyebrow", children: ["Exercise ", currentExerciseIndex + 1, " of ", exerciseTotal] }), _jsx("div", { className: "exercise-stage__status", children: isActive && _jsxs("span", { className: "pill", children: ["Set ", currentSetNumber] }) })] }), _jsx("h3", { className: "exercise-card__title", children: currentExercise.name }), _jsxs("p", { className: "card__hint", children: ["Target: ", currentExercise.target_sets, " sets \u00D7 ", currentExercise.target_reps, " reps \u2022", " ", currentExerciseType === "bodyweight" ? "Body weight" : "Weighted", " \u2022", " ", currentExercise.rest_seconds ? `${currentExercise.rest_seconds}s rest` : "Rest as needed"] }), _jsxs("small", { className: "exercise-card__next", children: ["Next: ", nextExercise ? nextExercise.name : "Wrap up"] })] }), _jsxs("div", { className: "exercise-stage__body", children: [_jsxs("div", { className: "exercise-stage__history", children: [previousExerciseSets.length > 0 && (_jsxs(_Fragment, { children: [_jsx("p", { className: "card__hint", children: "Previous session" }), previousExerciseSets.map((set, idx) => (_jsxs("div", { className: "set-table__row", children: [_jsxs("span", { className: "set-table__cell", children: ["Prev ", idx + 1] }), _jsxs("span", { className: "set-table__cell", children: [set.reps, " reps"] }), _jsx("span", { className: "set-table__cell", children: formatSetWeight(set) })] }, `previous-set-${idx}`)))] })), currentExerciseSets.length === 0 ? (_jsx("p", { className: "card__hint", children: "No sets logged for this exercise yet." })) : (currentExerciseSets.map((set, idx) => (_jsxs("div", { className: "set-table__row", children: [_jsxs("span", { className: "set-table__cell", children: ["Set ", idx + 1] }), _jsxs("span", { className: "set-table__cell", children: [set.reps, " reps"] }), _jsx("span", { className: "set-table__cell", children: formatSetWeight(set) })] }, `current-set-${idx}`)))))] }), _jsxs("div", { className: "set-row set-row--inline exercise-stage__form", onKeyDown: (event) => {
                                                                    if (event.key === "Enter") {
                                                                        event.preventDefault();
                                                                        handleAddSet();
                                                                    }
                                                                }, children: [_jsxs("div", { className: "set-row__field", children: [_jsx("input", { type: "number", min: 0, inputMode: "numeric", value: setForm.reps, onChange: (event) => setSetForm({ ...setForm, reps: Number(event.target.value) }), onFocus: (event) => event.currentTarget.select(), placeholder: "Reps", disabled: !activeTemplate || !isActive }), lastSetSuggestion && (_jsxs("div", { className: "set-row__hint card__hint", children: ["Last: ", lastSetSuggestion.reps, " reps"] }))] }), _jsxs("div", { className: "set-row__field", children: [_jsx("input", { type: "number", min: 0, inputMode: "numeric", value: setForm.weight, onChange: (event) => setSetForm({ ...setForm, weight: event.target.value }), onFocus: (event) => event.currentTarget.select(), placeholder: currentExerciseType === "bodyweight" ? "Modified reps" : `Weight (${preferredUnit})`, disabled: !activeTemplate || !isActive }), currentExerciseType === "bodyweight" && formatModifier(lastSetSuggestion?.modifier) && (_jsxs("div", { className: "set-row__hint card__hint", children: ["Last: +", formatModifier(lastSetSuggestion?.modifier), " mod reps"] })), currentExerciseType !== "bodyweight" && lastSetSuggestion?.weight && (_jsxs("div", { className: "set-row__hint card__hint", children: ["Last: ", lastSetSuggestion.weight] }))] }), _jsx("button", { type: "button", className: "set-row__action", onClick: handleAddSet, disabled: !activeTemplate || !isActive, "aria-label": "Save set", children: "\u23CE" })] })] })] })), _jsxs("div", { className: "guided-wizard__nav", children: [_jsx("button", { type: "button", className: "ghost", onClick: handlePrev, disabled: !hasPrev, children: "\u2190 Back" }), _jsx("div", { className: "guided-wizard__nav-status" }), _jsxs("button", { type: "button", onClick: handleNext, disabled: !hasNext, children: [wrapNextLabel, " \u2192"] })] })] }, slide.key));
                                }
                                if (slide.type === "finish") {
                                    return (_jsxs("section", { className: "guided-wizard__slide", children: [_jsx("div", { className: "section-heading", children: _jsxs("div", { children: [_jsxs("p", { className: "exercise-card__eyebrow", children: ["Step ", slides.length] }), _jsx("h3", { children: "Wrap up" }), _jsx("p", { className: "card__hint", children: "Capture notes and body weight before saving." })] }) }), _jsxs("div", { className: "guided-summary", children: [_jsxs("div", { className: "guided-summary__item", children: [_jsx("p", { className: "card__hint", children: "Elapsed" }), _jsx("strong", { children: formatClock(startTime ? elapsedMs : null) })] }), _jsxs("div", { className: "guided-summary__item", children: [_jsx("p", { className: "card__hint", children: "Sets logged" }), _jsx("strong", { children: loggedSets.length })] }), _jsxs("div", { className: "guided-summary__item", children: [_jsx("p", { className: "card__hint", children: "Template" }), _jsx("strong", { children: activeTemplate?.name ?? "—" })] })] }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { children: ["Session notes", _jsx("textarea", { rows: 3, value: notes, onChange: (event) => setNotes(event.target.value), placeholder: "Energy, PRs, anything worth remembering." })] }), _jsxs("label", { children: ["Body weight (", preferredUnit, ")", _jsx("input", { type: "number", min: 0, inputMode: "numeric", value: bodyWeight, onChange: (event) => setBodyWeight(event.target.value), onFocus: (event) => event.currentTarget.select() })] })] }), _jsxs("div", { className: "guided-wizard__nav", children: [_jsx("button", { type: "button", className: "ghost", onClick: handlePrev, disabled: !hasPrev, children: "\u2190 Back" }), _jsx("div", { className: "guided-wizard__nav-status", children: _jsxs("small", { children: ["Slide ", activeSlide + 1, " of ", slides.length] }) }), _jsx("button", { type: "button", className: "ghost ghost--danger ghost--small", onClick: handleAbort, disabled: !canAbort, children: "\uD83D\uDED1 Abort" })] }), _jsx("button", { type: "button", className: `finish-button${isRestExpired ? " finish-button--alert" : ""}`, onClick: handleFinish, disabled: !startTime || Boolean(endTime), children: "\uD83C\uDFC1 Finish" })] }, slide.key));
                                }
                                return null;
                            }) }) })] }), _jsxs("div", { className: "card card--subdued history-card", children: [_jsxs("div", { className: "section-heading", children: [_jsx("h3", { children: "Session log" }), _jsxs("small", { children: [loggedSets.length, " sets"] })] }), workoutHistory.length === 0 ? (_jsx("p", { className: "card__hint", children: "Sets you log will stack up here." })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "card__hint", children: "Tap a set to correct reps or modifiers." }), _jsx("ul", { className: "history-list", children: workoutHistory.map((entry) => (_jsxs("li", { className: "history-item", children: [_jsxs("div", { className: "history-item__header", children: [_jsx("strong", { children: entry.exercise }), _jsxs("small", { children: [entry.sets.length, " sets"] })] }), _jsx("div", { className: "history-item__sets", children: entry.sets.map(({ set, index }, idx) => {
                                                const isEditing = editingSet?.index === index;
                                                if (isEditing) {
                                                    return (_jsxs("form", { className: "history-edit", onSubmit: handleEditSubmit, children: [_jsxs("div", { className: "history-edit__fields", children: [_jsxs("label", { className: "history-edit__field", children: [_jsx("span", { children: "Reps" }), _jsx("input", { type: "number", min: 0, inputMode: "numeric", value: editingSet.reps, onChange: (event) => setEditingSet((prev) => prev ? { ...prev, reps: Number(event.target.value) } : prev), onFocus: (event) => event.currentTarget.select() })] }), _jsxs("label", { className: "history-edit__field", children: [_jsx("span", { children: set.exercise_type === "bodyweight" ? "Modified reps" : "Weight" }), _jsx("input", { type: "number", min: 0, inputMode: "numeric", value: editingSet.weight, onChange: (event) => setEditingSet((prev) => prev ? { ...prev, weight: event.target.value } : prev), placeholder: set.exercise_type === "bodyweight" ? "Modified reps" : `Weight (${set.unit})`, onFocus: (event) => event.currentTarget.select() })] })] }), _jsxs("div", { className: "history-edit__actions", children: [_jsx("button", { type: "submit", className: "ghost", children: "Save" }), _jsx("button", { type: "button", className: "ghost ghost--danger", onClick: handleCancelEdit, children: "Cancel" })] })] }, `${entry.exercise}-${index}-edit`));
                                                }
                                                return (_jsxs("button", { type: "button", className: "pill pill--muted history-item__pill", onClick: () => handleEditSet(index), "aria-label": `Edit set ${idx + 1} of ${entry.exercise}`, children: ["Set ", idx + 1, ": ", set.reps, " reps", set.exercise_type === "bodyweight" ? ` (${formatSetWeight(set)})` : ` @ ${formatSetWeight(set)}`] }, `${entry.exercise}-${index}`));
                                            }) })] }, entry.exercise))) })] }))] })] }));
};
export default GuidedWorkout;
