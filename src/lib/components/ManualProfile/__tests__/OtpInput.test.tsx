import { fireEvent, render, screen } from "@testing-library/react";
import OtpInput from "../OtpInput";

describe("OtpInput", () => {
  it("renders exactly six digit boxes and no group separator", () => {
    const { container } = render(<OtpInput />);
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
    // The old shared PasscodeInput injected a literal "-" between groups; the
    // Figma OTP has six uniform boxes with no separator character.
    expect(container.textContent).not.toContain("-");
  });

  it("auto-advances focus to the next box and reports the entered digit", () => {
    const onDigitChange = jest.fn();
    render(<OtpInput onDigitChange={onDigitChange} />);
    const boxes = screen.getAllByRole("textbox") as HTMLInputElement[];

    fireEvent.change(boxes[0], { target: { value: "4" } });

    expect(onDigitChange).toHaveBeenCalledWith(0, "4");
    expect(document.activeElement).toBe(boxes[1]);
  });

  it("moves focus back to the previous box on backspace when empty", () => {
    render(<OtpInput />);
    const boxes = screen.getAllByRole("textbox") as HTMLInputElement[];
    boxes[2].focus();

    fireEvent.keyDown(boxes[2], { key: "Backspace" });

    expect(document.activeElement).toBe(boxes[1]);
  });

  it("fires onComplete with the full code once all six digits are entered", () => {
    const onComplete = jest.fn();
    render(<OtpInput onComplete={onComplete} />);
    const boxes = screen.getAllByRole("textbox") as HTMLInputElement[];

    "123456".split("").forEach((digit, index) => {
      fireEvent.change(boxes[index], { target: { value: digit } });
    });

    expect(onComplete).toHaveBeenCalledWith("123456");
  });
});
