import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchSession, listWorkouts, createWorkout, deleteWorkout, fetchTrends } from "./lib/api";
import { loginWithPasskey, logout, registerPasskey } from "./lib/passkeys";
import WorkoutForm from "./components/WorkoutForm";
import WorkoutList from "./components/WorkoutList";
import TrendChart from "./components/TrendChart";
import AppleSignInButton from "./components/AppleSignInButton";
import SettingsMenu from "./components/SettingsMenu";
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
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => deleteWorkout(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workouts"] }),
    });
    const handleCreate = (payload) => {
        setError(null);
        createMutation.mutate(payload);
    };
    const handleDelete = (id) => deleteMutation.mutate(id);
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
    return (_jsxs("main", { className: "page-shell", children: [_jsxs("header", { className: topBarClass, children: [_jsxs("div", { className: "brand", children: [_jsx("span", { className: "brand__mark", "aria-hidden": "true", children: "\uD83C\uDFCB\uFE0F\u200D\u2642\uFE0F" }), _jsxs("div", { children: [_jsx("p", { className: "brand__eyebrow", children: "Workout Tracker" }), _jsxs("h1", { className: "brand__title", children: ["Welcome back, ", user.display_name || "Athlete"] })] })] }), _jsx(SettingsMenu, { userName: user.display_name, preference: themePreference, resolvedTheme: themePreference === "system" ? systemTheme : themePreference, onThemeChange: setThemePreference, unitPreference: unitPreference, onUnitChange: setUnitPreference, onSignOut: () => logout().then(() => {
                            sessionQuery.refetch();
                        }) })] }), error && _jsx("small", { style: { color: "var(--danger)" }, children: error }), _jsx("section", { className: "hero card", children: _jsxs("div", { children: [_jsx("p", { className: "hero__eyebrow", children: "Synced & ready" }), _jsx("h2", { children: "Track every session with confidence." }), _jsx("p", { className: "hero__copy", children: "Log sets, spot trends, and keep your workouts tied to you with passkey sign-in." }), _jsxs("div", { className: "hero__pills", children: [_jsxs("span", { className: "pill", "aria-label": "Workouts logged", children: ["\uD83D\uDCD3 ", workoutsQuery.data?.length ?? 0, " logged"] }), _jsxs("span", { className: "pill", "aria-label": "Theme in use", children: [themePreference === "dark" ? "🌙" : themePreference === "light" ? "🌞" : "🖥️", " ", themePreference, " mode"] }), _jsxs("span", { className: "pill", "aria-label": "Units preference", children: ["\u2696\uFE0F ", unitPreference === "metric" ? "Metric (kg)" : "Imperial (lb)"] })] })] }) }), _jsxs("div", { className: "layout-grid", children: [_jsx("div", { className: "layout-stack", children: _jsx(WorkoutForm, { onSubmit: handleCreate, unitPreference: unitPreference }) }), _jsxs("div", { className: "layout-stack", children: [_jsx(WorkoutList, { workouts: workoutsQuery.data ?? [], unitPreference: unitPreference, onDelete: handleDelete }), _jsx(TrendChart, { data: trendsQuery.data ?? [], unitPreference: unitPreference })] })] })] }));
};
export default App;
