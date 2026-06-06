import { fireEvent, render, screen } from "@testing-library/react";
import InlineMultiEntryStep from "../InlineMultiEntryStep";
import EducationEntryForm, { createEmptyEducation } from "../EducationEntryForm";
import type { EducationSectionItem } from "@/lib/utils/structuredCV";

function renderStep(items: EducationSectionItem[], onChange = jest.fn()) {
  render(
    <InlineMultiEntryStep
      items={items}
      onChange={onChange}
      createEmpty={createEmptyEducation}
      entryNoun="education"
      entryLabel={(entry, index) => entry.school.trim() || `Education ${index + 1}`}
      renderForm={(value, change) => (
        <EducationEntryForm value={value} onChange={change} />
      )}
    />,
  );
  return { onChange };
}

describe("Education inline accordion step", () => {
  it("seeds one entry when there are none", () => {
    const { onChange } = renderStep([]);
    const seeded = onChange.mock.calls.at(-1)?.[0] as EducationSectionItem[];
    expect(seeded).toHaveLength(1);
  });

  it("renders the entry form expanded with the School field", () => {
    renderStep([createEmptyEducation()]);
    expect(screen.getByLabelText(/school/i)).toBeInTheDocument();
  });

  it("updates the entry on edit", () => {
    const { onChange } = renderStep([createEmptyEducation()]);

    fireEvent.change(screen.getByLabelText(/school/i), {
      target: { value: "Ateneo" },
    });

    const updated = onChange.mock.calls.at(-1)?.[0] as EducationSectionItem[];
    expect(updated[0].school).toBe("Ateneo");
  });

  it("collapses and expands when the header is toggled", () => {
    renderStep([{ ...createEmptyEducation(), school: "Test University" }]);
    expect(screen.getByLabelText(/school/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Test University" }));
    expect(screen.queryByLabelText(/school/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Test University" }));
    expect(screen.getByLabelText(/school/i)).toBeInTheDocument();
  });

  it("removes the chosen entry", () => {
    const a = { ...createEmptyEducation(), school: "A" };
    const b = { ...createEmptyEducation(), school: "B" };
    const { onChange } = renderStep([a, b]);

    const removeButtons = screen.getAllByRole("button", {
      name: /remove education/i,
    });
    expect(removeButtons).toHaveLength(2);

    fireEvent.click(removeButtons[1]);
    expect(onChange).toHaveBeenCalledWith([a]);
  });
});
