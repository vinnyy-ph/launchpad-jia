import { fireEvent, render, screen } from "@testing-library/react";
import SkillsStep from "../SkillsStep";

describe("SkillsStep", () => {
  it("adds a trimmed skill on Enter", () => {
    const onChange = jest.fn();
    render(<SkillsStep value={[]} onChange={onChange} />);

    const input = screen.getByLabelText(/add skill/i);
    fireEvent.change(input, { target: { value: "  Figma  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith(["Figma"]);
  });

  it("does not add a duplicate skill", () => {
    const onChange = jest.fn();
    render(<SkillsStep value={["Figma"]} onChange={onChange} />);

    const input = screen.getByLabelText(/add skill/i);
    fireEvent.change(input, { target: { value: "Figma" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders one chip per skill and removes the chosen one", () => {
    const onChange = jest.fn();
    render(<SkillsStep value={["Figma", "Sketch"]} onChange={onChange} />);

    expect(screen.getByText("Figma")).toBeInTheDocument();
    expect(screen.getByText("Sketch")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /remove figma/i }));
    expect(onChange).toHaveBeenCalledWith(["Sketch"]);
  });
});
