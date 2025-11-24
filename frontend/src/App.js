import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchSession, listWorkouts, createWorkout, deleteWorkout, fetchTrends, listTemplates, createTemplate, updateTemplate, deleteTemplate, } from "./lib/api";
import { loginWithPasskey, logout, registerPasskey } from "./lib/passkeys";
import WorkoutList from "./components/WorkoutList";
import TrendChart from "./components/TrendChart";
import AppleSignInButton from "./components/AppleSignInButton";
import SettingsMenu from "./components/SettingsMenu";
import GuidedWorkout from "./components/GuidedWorkout";
import TemplateBuilder from "./components/TemplateBuilder";
const THEME_STORAGE_KEY = "theme-preference";
const UNIT_STORAGE_KEY = "unit-preference";
const getStoredPreference = () => {
    if (typeof window === "undefined")
        return "system";
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
};
const getStoredUnitPreference = () => {
    if (typeof window === "undefined")
        return "metric";
    const stored = window.localStorage.getItem(UNIT_STORAGE_KEY);
    return stored === "metric" || stored === "imperial" ? stored : "metric";
};
const getSystemTheme = () => {
    if (typeof window === "undefined")
        return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};
const applyTheme = (preference, systemTheme) => {
    if (typeof document === "undefined")
        return;
    const resolved = preference === "system" ? systemTheme : preference;
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
};
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
const App = () => {
    const queryClient = useQueryClient();
    const [themePreference, setThemePreference] = useState(() => getStoredPreference());
    const [systemTheme, setSystemTheme] = useState(() => getSystemTheme());
    const [unitPreference, setUnitPreference] = useState(() => getStoredUnitPreference());
    const [error, setError] = useState(null);
    const [isScrolled, setIsScrolled] = useState(false);
    const [registering, setRegistering] = useState(false);
    const [registerMessage, setRegisterMessage] = useState(null);
    const [loggingIn, setLoggingIn] = useState(false);
    const [loginMessage, setLoginMessage] = useState(null);
    const [activeTimer, setActiveTimer] = useState(null);
    const [activeTab, setActiveTab] = useState("workout");
    const [liveWorkoutContext, setLiveWorkoutContext] = useState({
        isActive: false,
        exerciseName: null,
        setNumber: null,
        totalSets: null,
        restMs: null,
    });
    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleSystemThemeChange = (event) => setSystemTheme(event.matches ? "dark" : "light");
        setSystemTheme(mediaQuery.matches ? "dark" : "light");
        mediaQuery.addEventListener("change", handleSystemThemeChange);
        return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
    }, []);
    useEffect(() => {
        applyTheme(themePreference, systemTheme);
    }, [themePreference, systemTheme]);
    useEffect(() => {
        if (typeof window === "undefined")
            return;
        window.localStorage.setItem(UNIT_STORAGE_KEY, unitPreference);
    }, [unitPreference]);
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 8);
        };
        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);
    const sessionQuery = useQuery({
        queryKey: ["session"],
        queryFn: fetchSession,
    });
    const workoutsQuery = useQuery({
        queryKey: ["workouts"],
        queryFn: listWorkouts,
        enabled: Boolean(sessionQuery.data),
    });
    const templatesQuery = useQuery({
        queryKey: ["templates"],
        queryFn: listTemplates,
        enabled: Boolean(sessionQuery.data),
    });
    const trendsQuery = useQuery({
        queryKey: ["trends"],
        queryFn: fetchTrends,
        enabled: Boolean(sessionQuery.data),
    });
    const createMutation = useMutation({
        mutationFn: (payload) => createWorkout(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["workouts"] });
            queryClient.invalidateQueries({ queryKey: ["trends"] });
        },
        onError: () => setError("Saving workout failed. Please try again."),
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => deleteWorkout(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workouts"] }),
    });
    const templateCreateMutation = useMutation({
        mutationFn: createTemplate,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
        onError: () => setError("Saving template failed. Please try again."),
    });
    const templateUpdateMutation = useMutation({
        mutationFn: updateTemplate,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
        onError: () => setError("Updating template failed. Please try again."),
    });
    const templateDeleteMutation = useMutation({
        mutationFn: (id) => deleteTemplate(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
    });
    const handleCreate = (payload) => {
        setError(null);
        createMutation.mutate(payload);
    };
    const handleDelete = (id) => deleteMutation.mutate(id);
    const handleTimerUpdate = (elapsedMs) => {
        if (elapsedMs === null) {
            setActiveTimer(null);
            return;
        }
        const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const pad = (value) => value.toString().padStart(2, "0");
        const label = hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
        setActiveTimer(label);
    };
    if (sessionQuery.isLoading) {
        return _jsx("p", { style: { padding: "2rem" }, children: "Loading..." });
    }
    const topBarClass = `top-bar${isScrolled ? " top-bar--condensed" : ""}`;
    const user = sessionQuery.data;
    if (!user) {
        const handleRegistration = async () => {
            try {
                setRegistering(true);
                setRegisterMessage(null);
                await registerPasskey();
                await sessionQuery.refetch();
                setRegisterMessage("Passkey created and you're signed in.");
            }
            catch (err) {
                console.error(err);
                setRegisterMessage("Passkey registration failed. Try again.");
            }
            finally {
                setRegistering(false);
            }
        };
        return (_jsxs("main", { className: "page-shell", children: [_jsxs("div", { className: topBarClass, children: [_jsxs("div", { className: "brand", children: [_jsx("span", { className: "brand__mark", "aria-hidden": "true", children: "\uD83C\uDFCB\uFE0F\u200D\u2640\uFE0F" }), _jsxs("div", { children: [_jsx("p", { className: "brand__eyebrow", children: "Workout Tracker" }), _jsx("h1", { className: "brand__title", children: "Log. Improve. Repeat." })] })] }), _jsx(SettingsMenu, { preference: themePreference, resolvedTheme: themePreference === "system" ? systemTheme : themePreference, onThemeChange: setThemePreference, unitPreference: unitPreference, onUnitChange: setUnitPreference })] }), _jsxs("div", { className: "auth-grid", children: [_jsxs("div", { className: "card", children: [_jsx("h2", { children: "\uD83D\uDD10 Set up your passkey" }), _jsx("p", { children: "Register a passkey to sync your workouts without extra steps." }), _jsx("button", { onClick: handleRegistration, disabled: registering, children: registering ? "Waiting for device..." : "Register Passkey" }), registerMessage && _jsx("small", { children: registerMessage })] }), _jsxs("div", { className: "card", children: [_jsx("h2", { children: "\uD83C\uDF9F\uFE0F Already registered?" }), _jsx("p", { children: "Use your passkey to unlock your workout history." }), _jsx("button", { onClick: async () => {
                                        try {
                                            setLoggingIn(true);
                                            setLoginMessage(null);
                                            await loginWithPasskey();
                                            await sessionQuery.refetch();
                                        }
                                        catch (err) {
                                            console.error(err);
                                            setLoginMessage("Passkey login failed. Try again.");
                                        }
                                        finally {
                                            setLoggingIn(false);
                                        }
                                    }, disabled: loggingIn, children: loggingIn ? "Waiting for device..." : "Log in with Passkey" }), loginMessage && _jsx("small", { children: loginMessage })] })] }), _jsx(AppleSignInButton, { onComplete: () => {
                        sessionQuery.refetch();
                    } })] }));
    }
    return (_jsxs("main", { className: "page-shell", children: [_jsxs("header", { className: topBarClass, children: [_jsxs("div", { className: "brand", children: [_jsx("span", { className: "brand__mark", "aria-hidden": "true", children: "\uD83C\uDFCB\uFE0F\u200D\u2642\uFE0F" }), _jsxs("div", { children: [_jsx("p", { className: "brand__eyebrow", children: liveWorkoutContext.isActive ? "Workout live" : "Workout Tracker" }), _jsx("h1", { className: "brand__title", children: liveWorkoutContext.isActive ? liveWorkoutContext.exerciseName ?? "In session" : "Log. Improve. Repeat." }), liveWorkoutContext.isActive && (_jsxs("small", { className: "brand__sub", children: ["Set ", liveWorkoutContext.setNumber ?? 1, liveWorkoutContext.totalSets ? ` of ${liveWorkoutContext.totalSets}` : ""] }))] })] }), _jsxs("div", { className: "top-bar__controls", children: [liveWorkoutContext.isActive && (_jsxs("div", { className: "top-bar__live", children: [_jsxs("div", { className: "top-bar__timer", children: [_jsx("p", { children: "Rest timer" }), _jsx("strong", { children: formatClock(liveWorkoutContext.restMs) })] }), activeTimer && (_jsxs("div", { className: "top-bar__timer", children: [_jsx("p", { children: "Workout" }), _jsx("strong", { children: activeTimer })] }))] })), _jsx(SettingsMenu, { userName: user.display_name, preference: themePreference, resolvedTheme: themePreference === "system" ? systemTheme : themePreference, onThemeChange: setThemePreference, unitPreference: unitPreference, onUnitChange: setUnitPreference, onSignOut: () => logout().then(() => {
                                    sessionQuery.refetch();
                                }) })] })] }), error && _jsx("small", { style: { color: "var(--danger)" }, children: error }), _jsxs("div", { className: "tabs", children: [_jsx("button", { className: `tab ${activeTab === "workout" ? "is-active" : ""}`, onClick: () => setActiveTab("workout"), children: "\uD83C\uDFC3 Workout" }), _jsx("button", { className: `tab ${activeTab === "templates" ? "is-active" : ""}`, onClick: () => setActiveTab("templates"), children: "\uD83D\uDDC2\uFE0F Templates" }), _jsx("button", { className: `tab ${activeTab === "trends" ? "is-active" : ""}`, onClick: () => setActiveTab("trends"), children: "\uD83D\uDCC8 Trends" })] }), activeTab === "workout" && (_jsx("div", { className: "layout-stack", children: _jsx(GuidedWorkout, { templates: templatesQuery.data ?? [], workouts: workoutsQuery.data ?? [], onSave: handleCreate, unitPreference: unitPreference, onTimerUpdate: handleTimerUpdate, onLiveContextChange: setLiveWorkoutContext, userId: user.id }) })), activeTab === "templates" && (_jsx("div", { className: "layout-stack", children: _jsx(TemplateBuilder, { templates: templatesQuery.data ?? [], onCreate: (payload) => templateCreateMutation.mutate(payload), onUpdate: (payload) => templateUpdateMutation.mutate(payload), onDelete: (id) => templateDeleteMutation.mutate(id), isSubmitting: templateCreateMutation.isPending, isUpdating: templateUpdateMutation.isPending }) })), activeTab === "trends" && (_jsxs("div", { className: "layout-grid", children: [_jsx("section", { className: "hero card", children: _jsxs("div", { children: [_jsx("p", { className: "hero__eyebrow", children: "Templates + live timers" }), _jsx("h2", { children: "Start from a plan, then beat it." }), _jsx("p", { className: "hero__copy", children: "Build reusable workout templates, start a guided session, and keep a running clock with auto rest tracking." }), _jsxs("div", { className: "hero__pills", children: [_jsxs("span", { className: "pill", "aria-label": "Workouts logged", children: ["\uD83D\uDCD3 ", workoutsQuery.data?.length ?? 0, " logged"] }), _jsxs("span", { className: "pill", "aria-label": "Templates saved", children: ["\uD83D\uDDC2\uFE0F ", templatesQuery.data?.length ?? 0, " templates"] }), _jsxs("span", { className: "pill", "aria-label": "Theme in use", children: [themePreference === "dark" ? "🌙" : themePreference === "light" ? "🌞" : "🖥️", " ", themePreference, " mode"] }), _jsxs("span", { className: "pill", "aria-label": "Units preference", children: ["\u2696\uFE0F ", unitPreference === "metric" ? "Metric (kg)" : "Imperial (lb)"] })] })] }) }), _jsx("div", { className: "layout-stack", children: _jsx(WorkoutList, { workouts: workoutsQuery.data ?? [], unitPreference: unitPreference, onDelete: handleDelete }) }), _jsx("div", { className: "layout-stack", children: _jsx(TrendChart, { data: trendsQuery.data, unitPreference: unitPreference }) })] }))] }));
};
export default App;
