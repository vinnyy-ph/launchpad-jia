import { fireEvent, render, screen } from "@testing-library/react";
import InlineMultiEntryStep from "../InlineMultiEntryStep";
import AwardEntryForm, { createEmptyAward } from "../AwardEntryForm";
import type { AwardSectionItem } from "@/lib/utils/structuredCV";

function renderStep(items: AwardSectionItem[], onChange = jest.fn()) {
  render(
    <InlineMultiEntryStep
      items={items}
      onChange={onChange}
      createEmpty={createEmptyAward}
      entryNoun="award"
      entryLabel={(entry, index) => entry.title.trim() || `Award ${index + 1}`}
      renderForm={(value, change) => (
        <AwardEntryForm value={value} onChange={change} />
      )}
    />,
  );
  return { onChange };
}

describe("Awards inline accordion step", () => {
  it("renders the Award Title field", () => {
    renderStep([createEmptyAward()]);
    expect(screen.getByLabelText(/award title/i)).toBeInTheDocument();
  });

  it("updates the title on edit", () => {
    const { onChange } = renderStep([createEmptyAward()]);

    fireEvent.change(screen.getByLabelText(/award title/i), {
      target: { value: "Employee of the Year" },
    });

    const updated = onChange.mock.calls.at(-1)?.[0] as AwardSectionItem[];
    expect(updated[0].title).toBe("Employee of the Year");
  });
});
