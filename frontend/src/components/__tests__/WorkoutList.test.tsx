import { render, screen } from "@testing-library/react";
import WorkoutList from "../WorkoutList";
import type { Workout } from "../../lib/api";

const baseWorkout: Workout = {
  id: "workout-1",
  title: "Test Workout",
  start_time: "2024-01-01T10:00:00.000Z",
  end_time: "2024-01-01T11:00:00.000Z",
  created_at: "2024-01-01T11:00:00.000Z",
  updated_at: "2024-01-01T11:00:00.000Z",
  body_weight: null,
  body_weight_timing: "before",
  notes: null,
  template_id: null,
  sets: [],
};

describe("WorkoutList", () => {
  it("renders weighted set summaries", () => {
    const workout: Workout = {
      ...baseWorkout,
      sets: [
        {
          exercise: "Bench",
          reps: 5,
          weight: 100,
          unit: "kg",
          exercise_type: "weighted",
        },
      ],
    };
    render(<WorkoutList workouts={[workout]} unitPreference="metric" onDelete={() => undefined} />);
    expect(screen.getByText(/Bench:\s*5x100 kg/)).toBeInTheDocument();
  });

  it("renders bodyweight modifier summaries", () => {
    const workout: Workout = {
      ...baseWorkout,
      sets: [
        {
          exercise: "Pushup",
          reps: 10,
          weight: 2,
          unit: "kg",
          exercise_type: "bodyweight",
        },
      ],
    };
    render(<WorkoutList workouts={[workout]} unitPreference="metric" onDelete={() => undefined} />);
    expect(screen.getByText(/Pushup:\s*10 reps \(\+2 mod\)/)).toBeInTheDocument();
  });
});
