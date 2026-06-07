import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ManualProfileWizard from "../ManualProfileWizard";

// Pins the R11 focus management: Next on an invalid step reveals the errors AND
// moves focus to the first aria-invalid control, so keyboard/SR users aren't
// left in silence. (Full wizard navigation/submit stays covered by the step- and
// util-level suites — see assembleProfile.test.ts NOTE.)
describe("ManualProfileWizard validation focus", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("focuses the first invalid field when Next reveals errors", async () => {
    render(<ManualProfileWizard onExit={jest.fn()} userEmail="a@b.com" />);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    const firstName = screen.getByPlaceholderText("First name");
    await waitFor(() => expect(firstName).toHaveFocus());
    expect(firstName).toHaveAttribute("aria-invalid", "true");
  });
});
