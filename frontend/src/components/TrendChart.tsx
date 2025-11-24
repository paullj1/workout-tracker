import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { useMemo } from "react";
import { fromKgToPreference, preferredWeightUnit } from "../lib/units";
import type { UnitSystem } from "../types/units";
import type { TrendPoint } from "../lib/api";

type Props = {
  data: TrendPoint[];
  unitPreference: UnitSystem;
};

const TrendChart = ({ data, unitPreference }: Props) => {
  const preferredUnit = useMemo(() => preferredWeightUnit(unitPreference), [unitPreference]);
  const convertedData = useMemo<TrendPoint[]>(
    () =>
      data.map((point) => ({
        ...point,
        tonnage: Math.round(fromKgToPreference(point.tonnage, unitPreference) * 10) / 10,
        average_body_weight:
          point.average_body_weight === null || point.average_body_weight === undefined
            ? null
            : Math.round(fromKgToPreference(point.average_body_weight, unitPreference) * 10) / 10,
      })),
    [data, unitPreference],
  );

  const tooltipFormatter = (value: number, name: string) => {
    if (name.startsWith("Tonnage") || name.startsWith("Avg Body Weight")) {
      const rounded = Math.round((value as number) * 10) / 10;
      return [`${rounded} ${preferredUnit}`, name];
    }
    return [value, name];
  };

  return (
    <div className="card card--chart">
      <div className="card__header">
        <h2>📈 Trend Overview</h2>
        <p className="card__hint">Volume, reps, and body weight over time.</p>
      </div>
      {convertedData.length === 0 ? (
        <p>We need at least one workout to graph trends.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={convertedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip formatter={tooltipFormatter} />
            <Legend />
            <Line type="monotone" dataKey="total_sets" stroke="#3b82f6" yAxisId="left" name="Sets" />
            <Line type="monotone" dataKey="total_reps" stroke="#10b981" yAxisId="left" name="Reps" />
            <Line
              type="monotone"
              dataKey="tonnage"
              stroke="#f97316"
              yAxisId="left"
              name={`Tonnage (${preferredUnit})`}
            />
            <Line
              type="monotone"
              dataKey="average_body_weight"
              stroke="#6366f1"
              yAxisId="right"
              name={`Avg Body Weight (${preferredUnit})`}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default TrendChart;
