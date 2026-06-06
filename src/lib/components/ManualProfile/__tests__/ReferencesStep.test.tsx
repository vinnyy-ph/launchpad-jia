import { fireEvent, render, screen } from "@testing-library/react";
import InlineMultiEntryStep from "../InlineMultiEntryStep";
import ReferenceEntryForm, { createEmptyReference } from "../ReferenceEntryForm";
import type { ReferenceSectionItem } from "@/lib/utils/structuredCV";

function renderStep(items: ReferenceSectionItem[], onChange = jest.fn()) {
  render(
    <InlineMultiEntryStep
      items={items}
      onChange={onChange}
      entryNoun="reference"
      entryLabel={(entry, index) => entry.name.trim() || `Reference ${index + 1}`}
      renderForm={(value, change) => (
        <ReferenceEntryForm value={value} onChange={change} />
      )}
    />,
  );
  return { onChange };
}

describe("References inline accordion step", () => {
  it("renders Name, Company and Phone number fields", () => {
    renderStep([createEmptyReference()]);
    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/company/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
  });

  it("captures the national phone number as E.164", () => {
    const { onChange } = renderStep([createEmptyReference()]);

    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: "9175551234" },
    });

    const updated = onChange.mock.calls.at(-1)?.[0] as ReferenceSectionItem[];
    expect(updated[0].phone).toBe("+639175551234");
  });
});
