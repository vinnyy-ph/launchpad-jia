import { render, screen } from "@testing-library/react";
import LabeledField from "../LabeledField";

describe("LabeledField", () => {
  it("associates the label with the control via htmlFor", () => {
    render(
      <LabeledField label="Start Date" htmlFor="start">
        <input id="start" />
      </LabeledField>,
    );
    expect(screen.getByText("Start Date")).toHaveAttribute("for", "start");
  });

  it("shows an asterisk when withAsterisk is set", () => {
    render(
      <LabeledField label="Name" withAsterisk>
        <input />
      </LabeledField>,
    );
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("renders an error message when provided", () => {
    render(
      <LabeledField label="Name" error="Required">
        <input />
      </LabeledField>,
    );
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("gives the error an id derived from htmlFor (aria-describedby target)", () => {
    render(
      <LabeledField label="Name" htmlFor="name" error="Required">
        <input id="name" aria-describedby="name-error" />
      </LabeledField>,
    );
    expect(screen.getByText("Required")).toHaveAttribute("id", "name-error");
  });

  it("omits the error id when there is no htmlFor", () => {
    render(
      <LabeledField label="Name" error="Required">
        <input />
      </LabeledField>,
    );
    expect(screen.getByText("Required")).not.toHaveAttribute("id");
  });

  it("omits the label element when no label is given", () => {
    const { container } = render(
      <LabeledField>
        <input />
      </LabeledField>,
    );
    expect(container.querySelector("label")).toBeNull();
  });
});
