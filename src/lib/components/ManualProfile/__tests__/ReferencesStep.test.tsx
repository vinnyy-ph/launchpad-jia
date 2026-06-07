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

  it("falls back gracefully when a stored countryCode is unsupported", () => {
    // Wizard-created entries always carry a supported code; this pins the
    // guard for hand-edited drafts / legacy docs (previously crashed in
    // maxNationalDigits via NATIONAL_NUMBER_FORMAT[undefined]).
    const ref = { ...createEmptyReference(), countryCode: "XX", phone: "" };
    expect(() => renderStep([ref])).not.toThrow();
    // Unsupported code -> inferred from phone (empty -> PH dial code).
    expect(screen.getByText("+63")).toBeInTheDocument();
  });
});
