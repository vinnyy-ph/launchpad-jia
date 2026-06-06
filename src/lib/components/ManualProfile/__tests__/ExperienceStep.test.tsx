import { fireEvent, render, screen } from "@testing-library/react";
import InlineMultiEntryStep from "../InlineMultiEntryStep";
import ExperienceEntryForm, {
  createEmptyExperience,
} from "../ExperienceEntryForm";
import type { ExperienceSectionItem } from "@/lib/utils/structuredCV";

function renderStep(items: ExperienceSectionItem[], onChange = jest.fn()) {
  render(
    <InlineMultiEntryStep
      items={items}
      onChange={onChange}
      entryNoun="experience"
      entryLabel={(entry, index) =>
        entry.title.trim() || entry.company.trim() || `Experience ${index + 1}`
      }
      renderForm={(value, change) => (
        <ExperienceEntryForm value={value} onChange={change} />
      )}
    />,
  );
  return { onChange };
}

describe("Experience inline accordion step", () => {
  it("renders the entry form expanded with the Job Title field", () => {
    renderStep([createEmptyExperience()]);
    expect(screen.getByLabelText(/job title/i)).toBeInTheDocument();
  });

  it("updates a field on edit", () => {
    const { onChange } = renderStep([createEmptyExperience()]);

    fireEvent.change(screen.getByLabelText(/job title/i), {
      target: { value: "Engineer" },
    });

    const updated = onChange.mock.calls.at(-1)?.[0] as ExperienceSectionItem[];
    expect(updated[0].title).toBe("Engineer");
  });

  it("toggles 'currently working in this role'", () => {
    const { onChange } = renderStep([createEmptyExperience()]);

    fireEvent.click(screen.getByLabelText(/currently working in this role/i));

    const updated = onChange.mock.calls.at(-1)?.[0] as ExperienceSectionItem[];
    expect(updated[0].isCurrentRole).toBe(true);
  });
});
