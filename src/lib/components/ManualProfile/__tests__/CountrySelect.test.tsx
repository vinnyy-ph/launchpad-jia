import { fireEvent, render, screen } from "@testing-library/react";
import CountrySelect from "../CountrySelect";

describe("CountrySelect", () => {
  it("is closed initially and opens the listbox on trigger click", () => {
    render(<CountrySelect value="PH" onChange={jest.fn()} />);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /country/i }));

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(5);
  });

  it("calls onChange with the chosen country and closes the menu", () => {
    const onChange = jest.fn();
    render(<CountrySelect value="PH" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /country/i }));
    fireEvent.click(screen.getByRole("option", { name: /united states/i }));

    expect(onChange).toHaveBeenCalledWith("US");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("marks the active country as selected", () => {
    render(<CountrySelect value="SG" onChange={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /country/i }));

    expect(
      screen.getByRole("option", { name: /singapore/i }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("closes on Escape", () => {
    render(<CountrySelect value="PH" onChange={jest.fn()} />);
    const trigger = screen.getByRole("button", { name: /country/i });

    fireEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
