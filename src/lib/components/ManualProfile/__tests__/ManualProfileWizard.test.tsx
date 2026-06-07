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

// Pins the R12d guard-entry consumption wiring. jsdom doesn't really traverse
// history, so back() is spied and its popstate simulated — what's pinned is:
// armed guard → exactly one back() + the exiting flag swallowing the resulting
// popstate (no re-push); unarmed guard → no back() at all.
describe("ManualProfileWizard dirty-guard history entry", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("consumes the armed entry on Save & Exit and ignores the programmatic popstate", async () => {
    const onExit = jest.fn();
    const pushSpy = jest.spyOn(window.history, "pushState");
    const backSpy = jest.spyOn(window.history, "back").mockImplementation(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    render(<ManualProfileWizard onExit={onExit} userEmail="a@b.com" />);
    // Dirty the form → the guard effect pushes its history entry.
    fireEvent.change(screen.getByPlaceholderText("First name"), {
      target: { value: "K" },
    });
    await waitFor(() => expect(pushSpy).toHaveBeenCalledTimes(1));

    // Header back at step 0 while dirty → discard prompt → Save & Exit.
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save & Exit" }));

    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
    // The simulated popstate must NOT re-arm the guard (a broken exiting flag
    // would push a second entry from onPop).
    expect(pushSpy).toHaveBeenCalledTimes(1);

    pushSpy.mockRestore();
    backSpy.mockRestore();
  });

  it("does not call history.back when the guard never armed", () => {
    const onExit = jest.fn();
    const backSpy = jest.spyOn(window.history, "back").mockImplementation(() => {});

    render(<ManualProfileWizard onExit={onExit} userEmail="a@b.com" />);
    // Clean exit straight away (never dirty → nothing pushed, nothing to consume).
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(backSpy).not.toHaveBeenCalled();

    backSpy.mockRestore();
  });
});
