import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchSession, listWorkouts, createWorkout, deleteWorkout, fetchTrends, type WorkoutPayload } from "./lib/api";
import { loginWithPasskey, logout, registerPasskey } from "./lib/passkeys";
import WorkoutForm from "./components/WorkoutForm";
import WorkoutList from "./components/WorkoutList";
import TrendChart from "./components/TrendChart";
import AppleSignInButton from "./components/AppleSignInButton";
import SettingsMenu from "./components/SettingsMenu";
import type { Theme, ThemePreference } from "./types/theme";
import type { UnitSystem } from "./types/units";

const THEME_STORAGE_KEY = "theme-preference";
const UNIT_STORAGE_KEY = "unit-preference";

const getStoredPreference = (): ThemePreference => {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
};

const getStoredUnitPreference = (): UnitSystem => {
  if (typeof window === "undefined") return "metric";
  const stored = window.localStorage.getItem(UNIT_STORAGE_KEY);
  return stored === "metric" || stored === "imperial" ? stored : "metric";
};

const getSystemTheme = (): Theme => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const applyTheme = (preference: ThemePreference, systemTheme: Theme) => {
  if (typeof document === "undefined") return;
  const resolved = preference === "system" ? systemTheme : preference;
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
};

const App = () => {
  const queryClient = useQueryClient();
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => getStoredPreference());
  const [systemTheme, setSystemTheme] = useState<Theme>(() => getSystemTheme());
  const [unitPreference, setUnitPreference] = useState<UnitSystem>(() => getStoredUnitPreference());
  const [error, setError] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerMessage, setRegisterMessage] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? "dark" : "light");
    setSystemTheme(mediaQuery.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, []);

  useEffect(() => {
    applyTheme(themePreference, systemTheme);
  }, [themePreference, systemTheme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
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
    mutationFn: (payload: WorkoutPayload) => createWorkout(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["trends"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWorkout(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workouts"] }),
  });

  const handleCreate = (payload: WorkoutPayload) => {
    setError(null);
    createMutation.mutate(payload);
  };

  const handleDelete = (id: string) => deleteMutation.mutate(id);

  if (sessionQuery.isLoading) {
    return <p style={{ padding: "2rem" }}>Loading...</p>;
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
      } catch (err) {
        console.error(err);
        setRegisterMessage("Passkey registration failed. Try again.");
      } finally {
        setRegistering(false);
      }
    };

    return (
      <main className="page-shell">
        <div className={topBarClass}>
          <div className="brand">
            <span className="brand__mark" aria-hidden="true">
              🏋️‍♀️
            </span>
            <div>
              <p className="brand__eyebrow">Workout Tracker</p>
              <h1 className="brand__title">Log. Improve. Repeat.</h1>
            </div>
          </div>
          <SettingsMenu
            preference={themePreference}
            resolvedTheme={themePreference === "system" ? systemTheme : themePreference}
            onThemeChange={setThemePreference}
            unitPreference={unitPreference}
            onUnitChange={setUnitPreference}
          />
        </div>

        <div className="auth-grid">
          <div className="card">
            <h2>🔐 Set up your passkey</h2>
            <p>Register a passkey to sync your workouts without extra steps.</p>
            <button onClick={handleRegistration} disabled={registering}>
              {registering ? "Waiting for device..." : "Register Passkey"}
            </button>
            {registerMessage && <small>{registerMessage}</small>}
          </div>
          <div className="card">
            <h2>🎟️ Already registered?</h2>
            <p>Use your passkey to unlock your workout history.</p>
            <button
              onClick={async () => {
                try {
                  setLoggingIn(true);
                  setLoginMessage(null);
                  await loginWithPasskey();
                  await sessionQuery.refetch();
                } catch (err) {
                  console.error(err);
                  setLoginMessage("Passkey login failed. Try again.");
                } finally {
                  setLoggingIn(false);
                }
              }}
              disabled={loggingIn}
            >
              {loggingIn ? "Waiting for device..." : "Log in with Passkey"}
            </button>
            {loginMessage && <small>{loginMessage}</small>}
          </div>
        </div>

        <AppleSignInButton
          onComplete={() => {
            sessionQuery.refetch();
          }}
        />
      </main>
    );
  }

  return (
    <main className="page-shell">
      <header className={topBarClass}>
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            🏋️‍♂️
          </span>
          <div>
            <p className="brand__eyebrow">Workout Tracker</p>
            <h1 className="brand__title">Welcome back, {user.display_name || "Athlete"}</h1>
          </div>
        </div>
        <SettingsMenu
          userName={user.display_name}
          preference={themePreference}
          resolvedTheme={themePreference === "system" ? systemTheme : themePreference}
          onThemeChange={setThemePreference}
          unitPreference={unitPreference}
          onUnitChange={setUnitPreference}
          onSignOut={() =>
            logout().then(() => {
              sessionQuery.refetch();
            })
          }
        />
      </header>

      {error && <small style={{ color: "var(--danger)" }}>{error}</small>}

      <section className="hero card">
        <div>
          <p className="hero__eyebrow">Synced &amp; ready</p>
          <h2>Track every session with confidence.</h2>
          <p className="hero__copy">Log sets, spot trends, and keep your workouts tied to you with passkey sign-in.</p>
          <div className="hero__pills">
            <span className="pill" aria-label="Workouts logged">
              📓 {workoutsQuery.data?.length ?? 0} logged
            </span>
            <span className="pill" aria-label="Theme in use">
              {themePreference === "dark" ? "🌙" : themePreference === "light" ? "🌞" : "🖥️"} {themePreference} mode
            </span>
            <span className="pill" aria-label="Units preference">
              ⚖️ {unitPreference === "metric" ? "Metric (kg)" : "Imperial (lb)"}
            </span>
          </div>
        </div>
      </section>

      <div className="layout-grid">
        <div className="layout-stack">
          <WorkoutForm onSubmit={handleCreate} unitPreference={unitPreference} />
        </div>
        <div className="layout-stack">
          <WorkoutList workouts={workoutsQuery.data ?? []} unitPreference={unitPreference} onDelete={handleDelete} />
          <TrendChart data={trendsQuery.data ?? []} unitPreference={unitPreference} />
        </div>
      </div>
    </main>
  );
};

export default App;
