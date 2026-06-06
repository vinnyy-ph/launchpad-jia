import { fireEvent, render, screen } from "@testing-library/react";
import InlineMultiEntryStep from "../InlineMultiEntryStep";
import ProjectEntryForm, { createEmptyProject } from "../ProjectEntryForm";
import type { ProjectSectionItem } from "@/lib/utils/structuredCV";

function renderStep(items: ProjectSectionItem[], onChange = jest.fn()) {
  render(
    <InlineMultiEntryStep
      items={items}
      onChange={onChange}
      createEmpty={createEmptyProject}
      entryNoun="project"
      entryLabel={(entry, index) => entry.name.trim() || `Project ${index + 1}`}
      renderForm={(value, change) => (
        <ProjectEntryForm value={value} onChange={change} />
      )}
    />,
  );
  return { onChange };
}

describe("Projects inline accordion step", () => {
  it("renders the entry form expanded with the Project name field", () => {
    renderStep([createEmptyProject()]);
    expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
  });

  it("updates the name on edit", () => {
    const { onChange } = renderStep([createEmptyProject()]);

    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: "Wellness App" },
    });

    const updated = onChange.mock.calls.at(-1)?.[0] as ProjectSectionItem[];
    expect(updated[0].name).toBe("Wellness App");
  });

  it("toggles 'currently working in this project'", () => {
    const { onChange } = renderStep([createEmptyProject()]);

    fireEvent.click(
      screen.getByLabelText(/currently working in this project/i),
    );

    const updated = onChange.mock.calls.at(-1)?.[0] as ProjectSectionItem[];
    expect(updated[0].isCurrent).toBe(true);
  });
});
