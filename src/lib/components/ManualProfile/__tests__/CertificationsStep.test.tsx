import { fireEvent, render, screen } from "@testing-library/react";
import InlineMultiEntryStep from "../InlineMultiEntryStep";
import CertificationEntryForm, {
  createEmptyCertification,
} from "../CertificationEntryForm";
import type { CertificationSectionItem } from "@/lib/utils/structuredCV";

function renderStep(items: CertificationSectionItem[], onChange = jest.fn()) {
  render(
    <InlineMultiEntryStep
      items={items}
      onChange={onChange}
      entryNoun="certification"
      entryLabel={(entry, index) => entry.name.trim() || `Certification ${index + 1}`}
      renderForm={(value, change) => (
        <CertificationEntryForm value={value} onChange={change} />
      )}
    />,
  );
  return { onChange };
}

describe("Certifications inline accordion step", () => {
  it("renders the Name and Issuing Organization fields", () => {
    renderStep([createEmptyCertification()]);
    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/issuing organization/i)).toBeInTheDocument();
  });

  it("updates the credential URL via the https:// combo input", () => {
    const { onChange } = renderStep([createEmptyCertification()]);

    fireEvent.change(screen.getByLabelText(/credential url/i), {
      target: { value: "credly.com/badge" },
    });

    const updated = onChange.mock.calls.at(-1)?.[0] as CertificationSectionItem[];
    expect(updated[0].credentialUrl).toBe("credly.com/badge");
  });
});
