jest.mock("react-toastify", () => ({ toast: { info: jest.fn(), dismiss: jest.fn() } }));
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

import { toast } from "react-toastify";
import type { ParsedCv } from "@/lib/utils/parseCvFile";

function parsedFixture(): ParsedCv {
  return {
    name: "Maria Santos",
    email: "ignored@parsed.com",
    structuredCV: {
      introduction: "Engineer.",
      contactInfo: {
        email: "ignored@parsed.com",
        phone: "+639170000000",
        countryCode: "",
        address: "Cebu",
        linkedin: "",
        websites: [],
      },
      experience: [],
      skills: ["React"],
      education: [],
      projects: [],
      certifications: [],
      awards: [],
    },
  } as unknown as ParsedCv;
}

function cvFileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

describe("ManualProfileWizard CV autofill", () => {
  beforeEach(() => {
    window.localStorage.clear();
    (toast.info as jest.Mock).mockClear();
  });

  it("shows the upload banner only when onParseCv is provided", () => {
    const { rerender } = render(<ManualProfileWizard onExit={jest.fn()} userEmail="a@b.com" />);
    expect(screen.queryByText("Already have a CV?")).not.toBeInTheDocument();

    rerender(
      <ManualProfileWizard onExit={jest.fn()} userEmail="a@b.com" onParseCv={jest.fn()} />,
    );
    expect(screen.getByText("Already have a CV?")).toBeInTheDocument();
  });

  it("opens the upload modal from the banner", async () => {
    render(<ManualProfileWizard onExit={jest.fn()} userEmail="a@b.com" onParseCv={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /upload cv/i }));
    expect(await screen.findByText("Upload your CV")).toBeInTheDocument();
  });

  it("autofills, keeps the locked email, lands on Contact, and shows the banner + toast", async () => {
    const onParseCv = jest.fn().mockResolvedValue(parsedFixture());
    render(<ManualProfileWizard onExit={jest.fn()} userEmail="a@b.com" onParseCv={onParseCv} />);

    fireEvent.click(screen.getByRole("button", { name: /upload cv/i }));
    await screen.findByText("Upload your CV");
    const file = new File(["x"], "cv.pdf", { type: "application/pdf" });
    fireEvent.change(cvFileInput(), { target: { files: [file] } });

    await waitFor(() => expect(onParseCv).toHaveBeenCalledWith(file));
    await waitFor(() =>
      expect(screen.getByPlaceholderText("First name")).toHaveValue("Maria"),
    );
    expect(screen.getByDisplayValue("a@b.com")).toBeInTheDocument(); // locked email kept
    expect(screen.getByText(/auto-filled from your cv/i)).toBeInTheDocument();
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it("confirms before overwriting when the wizard is already dirty", async () => {
    const onParseCv = jest.fn().mockResolvedValue(parsedFixture());
    render(<ManualProfileWizard onExit={jest.fn()} userEmail="a@b.com" onParseCv={onParseCv} />);

    fireEvent.change(screen.getByPlaceholderText("First name"), { target: { value: "K" } });
    fireEvent.click(screen.getByRole("button", { name: /upload cv/i }));
    await screen.findByText("Upload your CV");
    fireEvent.change(cvFileInput(), { target: { files: [new File(["x"], "cv.pdf")] } });

    await waitFor(() => expect(onParseCv).toHaveBeenCalled());
    expect(await screen.findByText("Replace your entries?")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("First name")).toHaveValue("K"); // not yet applied

    fireEvent.click(await screen.findByRole("button", { name: /replace with cv/i }));
    await waitFor(() =>
      expect(screen.getByPlaceholderText("First name")).toHaveValue("Maria"),
    );
  });

  it("re-infers the phone country after autofill (remounts the Contact step)", async () => {
    const onParseCv = jest.fn().mockResolvedValue({
      name: "John Doe",
      structuredCV: {
        introduction: "",
        contactInfo: {
          email: "",
          phone: "+14155551234",
          countryCode: "",
          address: "",
          linkedin: "",
          websites: [],
        },
        experience: [],
        skills: [],
        education: [],
        projects: [],
        certifications: [],
        awards: [],
      },
    } as unknown as ParsedCv);
    render(<ManualProfileWizard onExit={jest.fn()} userEmail="a@b.com" onParseCv={onParseCv} />);

    fireEvent.click(screen.getByRole("button", { name: /upload cv/i }));
    await screen.findByText("Upload your CV");
    fireEvent.change(cvFileInput(), { target: { files: [new File(["x"], "cv.pdf")] } });

    await waitFor(() => expect(screen.getByPlaceholderText("First name")).toHaveValue("John"));
    // The Contact step snapshots its phone country from props at mount only, so
    // applyAutofill must remount it; otherwise the dial code stays the stale +63
    // default for a parsed US (+1) number.
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.queryByText("+63")).not.toBeInTheDocument();
  });
});
