import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TemplateBuilder from "../TemplateBuilder";
import type { TemplatePayload } from "../../lib/api";

describe("TemplateBuilder", () => {
  it("submits bodyweight exercise types", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(
      <TemplateBuilder
        templates={[]}
        onCreate={onCreate}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/template name/i), "Bodyweight Plan");
    await user.type(screen.getByPlaceholderText(/exercise/i), "Pushup");
    const typeSelect = screen.getAllByLabelText(/type/i)[0];
    await user.selectOptions(typeSelect, "bodyweight");
    await user.click(screen.getByRole("button", { name: /save template/i }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    const payload = onCreate.mock.calls[0][0] as TemplatePayload;
    expect(payload.exercises[0].exercise_type).toBe("bodyweight");
  });

  it("renders bodyweight labels in saved templates", () => {
    render(
      <TemplateBuilder
        templates={[
          {
            id: "template-1",
            name: "Plan A",
            notes: null,
            created_at: "2024-01-01T00:00:00.000Z",
            updated_at: "2024-01-01T00:00:00.000Z",
            exercises: [
              {
                name: "Pushup",
                exercise_type: "bodyweight",
                target_sets: 3,
                target_reps: 12,
                rest_seconds: 30,
              },
            ],
          },
        ]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const list = screen.getByRole("list");
    expect(list).toHaveTextContent(/Body weight/);
  });
});
