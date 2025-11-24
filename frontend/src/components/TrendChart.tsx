import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { fromKgToPreference, preferredWeightUnit } from "../lib/units";
import type { UnitSystem } from "../types/units";
import type { TrendsResponse } from "../lib/api";

type Props = {
  data: TrendsResponse | undefined;
  unitPreference: UnitSystem;
};

type OverviewDatum = {
  dateLabel: string;
  total_sets: number;
  total_reps: number;
  tonnage: number;
  average_body_weight: number | null;
  duration_minutes: number | null;
};

type ExerciseDatum = {
  dateValue: number;
  dateLabel: string;
  tonnage: number;
  total_sets: number;
  total_reps: number;
};

const TrendChart = ({ data, unitPreference }: Props) => {
  const preferredUnit = useMemo(() => preferredWeightUnit(unitPreference), [unitPreference]);

  const weightLabel = (kg: number) => `${Math.round(fromKgToPreference(kg, unitPreference) * 10) / 10} ${preferredUnit}`;
  const dateLabel = (value: string) =>
    new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const overviewData = useMemo<OverviewDatum[]>(
    () =>
      (data?.overview ?? []).map((point) => ({
        dateLabel: dateLabel(point.date),
        total_sets: point.total_sets,
        total_reps: point.total_reps,
        tonnage: Math.round(fromKgToPreference(point.tonnage_kg, unitPreference) * 10) / 10,
        average_body_weight:
          point.average_body_weight_kg === null || point.average_body_weight_kg === undefined
            ? null
            : Math.round(fromKgToPreference(point.average_body_weight_kg, unitPreference) * 10) / 10,
        duration_minutes: point.duration_minutes === null || point.duration_minutes === undefined ? null : Math.round(point.duration_minutes * 10) / 10,
      })),
    [data, unitPreference],
  );

  const bodyWeightData = useMemo(
    () =>
      (data?.body_weight ?? []).map((point) => ({
        dateLabel: dateLabel(point.date),
        average_body_weight: Math.round(fromKgToPreference(point.average_body_weight_kg, unitPreference) * 10) / 10,
      })),
    [data, unitPreference],
  );

  const durationData = useMemo(
    () =>
      (data?.durations ?? []).map((point) => ({
        dateLabel: dateLabel(point.date),
        minutes: Math.round(point.duration_minutes * 10) / 10,
      })),
    [data],
  );

  const exerciseTotals = useMemo(() => {
    const totals = new Map<string, number>();
    (data?.exercise_volume ?? []).forEach((point) => {
      totals.set(point.exercise, (totals.get(point.exercise) ?? 0) + point.tonnage_kg);
    });
    return Array.from(totals.entries())
      .map(([exercise, tonnage_kg]) => ({ exercise, tonnage_kg }))
      .sort((a, b) => b.tonnage_kg - a.tonnage_kg);
  }, [data]);

  const [activeExercise, setActiveExercise] = useState<string | null>(null);

  useEffect(() => {
    if (exerciseTotals.length === 0) {
      setActiveExercise(null);
      return;
    }
    setActiveExercise((current) => {
      if (current && exerciseTotals.some((entry) => entry.exercise === current)) {
        return current;
      }
      return exerciseTotals[0].exercise;
    });
  }, [exerciseTotals]);

  const exerciseSeries = useMemo<ExerciseDatum[]>(() => {
    if (!activeExercise) return [];
    return (data?.exercise_volume ?? [])
      .filter((point) => point.exercise === activeExercise)
      .map((point) => {
        const timestamp = new Date(point.date).getTime();
        return {
          dateValue: timestamp,
          dateLabel: dateLabel(point.date),
          tonnage: Math.round(fromKgToPreference(point.tonnage_kg, unitPreference) * 10) / 10,
          total_sets: point.total_sets,
          total_reps: point.total_reps,
        };
      })
      .sort((a, b) => a.dateValue - b.dateValue);
  }, [activeExercise, data, unitPreference]);

  const hasAnyData =
    (data?.overview?.length ?? 0) > 0 ||
    (data?.body_weight?.length ?? 0) > 0 ||
    (data?.durations?.length ?? 0) > 0 ||
    (data?.exercise_volume?.length ?? 0) > 0;

  if (!hasAnyData) {
    return (
      <div className="card card--chart">
        <div className="card__header">
          <h2>📈 Trend Overview</h2>
          <p className="card__hint">Volume, time, and body weight over time.</p>
        </div>
        <p>Log a workout to start seeing your personal trends.</p>
      </div>
    );
  }

  const overviewTooltip = (value: number, name: string) => {
    if (name.includes("Weight") || name.includes("Tonnage")) {
      return [`${value} ${preferredUnit}`, name];
    }
    if (name.includes("Duration")) {
      return [`${value} min`, name];
    }
    return [value, name];
  };

  return (
    <div className="layout-grid">
      <div className="card card--chart">
        <div className="card__header">
          <div>
            <h2>📊 Daily Overview</h2>
            <p className="card__hint">Sets, reps, tonnage, and session length by day.</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={overviewData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="dateLabel" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip formatter={overviewTooltip} />
            <Legend />
            <Line type="monotone" dataKey="total_sets" stroke="#3b82f6" yAxisId="left" name="Sets" />
            <Line type="monotone" dataKey="total_reps" stroke="#10b981" yAxisId="left" name="Reps" />
            <Line
              type="monotone"
              dataKey="tonnage"
              stroke="#f97316"
              yAxisId="right"
              name={`Tonnage (${preferredUnit})`}
            />
            <Line
              type="monotone"
              dataKey="duration_minutes"
              stroke="#8b5cf6"
              yAxisId="right"
              name="Workout Duration (min)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card card--chart">
        <div className="card__header">
          <div>
            <h2>🕒 Workout Time</h2>
            <p className="card__hint">How long each session lasted.</p>
          </div>
        </div>
        {durationData.length === 0 ? (
          <p>Wrap up workouts to track time spent.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={durationData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dateLabel" />
              <YAxis />
              <Tooltip formatter={(value: number) => [`${value} min`, "Duration"]} />
              <Legend />
              <Bar dataKey="minutes" fill="#8b5cf6" name="Minutes" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card card--chart">
        <div className="card__header">
          <div>
            <h2>⚖️ Body Weight</h2>
            <p className="card__hint">Average body weight captured per day.</p>
          </div>
        </div>
        {bodyWeightData.length === 0 ? (
          <p>Add body weight when saving a workout to see this trend.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={bodyWeightData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dateLabel" />
              <YAxis />
              <Tooltip formatter={(value: number) => [`${value} ${preferredUnit}`, "Average"]} />
              <Legend />
              <Area
                type="monotone"
                dataKey="average_body_weight"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.15}
                name={`Body Weight (${preferredUnit})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card card--chart">
        <div className="card__header">
          <div>
            <h2>🏋️ Exercise Volume</h2>
            <p className="card__hint">Weight moved per exercise across sessions.</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {exerciseTotals.slice(0, 5).map((entry) => {
              const isActive = activeExercise === entry.exercise;
              return (
                <button
                  key={entry.exercise}
                  type="button"
                  className={`pill${isActive ? "" : " pill--muted"}`}
                  onClick={() => setActiveExercise(entry.exercise)}
                  aria-pressed={isActive}
                >
                  {entry.exercise} • {weightLabel(entry.tonnage_kg)}
                </button>
              );
            })}
          </div>
        </div>
        {exerciseSeries.length === 0 ? (
          <p>Log sets with weights to break down volume by exercise.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={exerciseSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dateLabel" />
              <YAxis />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === "tonnage") return [`${value} ${preferredUnit}`, "Tonnage"];
                  return [value, name === "total_sets" ? "Sets" : "Reps"];
                }}
              />
              <Legend />
              <Area type="monotone" dataKey="tonnage" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.18} name={`Tonnage (${preferredUnit})`} />
              <Line type="monotone" dataKey="total_sets" stroke="#3b82f6" name="Sets" />
              <Line type="monotone" dataKey="total_reps" stroke="#10b981" name="Reps" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default TrendChart;
