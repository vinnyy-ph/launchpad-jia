import { fireEvent, render, screen } from "@testing-library/react";
import RichTextField from "../RichTextField";

describe("RichTextField", () => {
  it("renders the label and all six formatting buttons", () => {
    render(<RichTextField id="d" label="Description" value="" onChange={jest.fn()} />);

    expect(screen.getByRole("textbox", { name: /description/i })).toBeInTheDocument();
    ["Bold", "Italic", "Underline", "Strikethrough", "Numbered list", "Bulleted list"].forEach(
      (name) => {
        expect(screen.getByRole("button", { name })).toBeInTheDocument();
      },
    );
  });

  it("emits the editor HTML on input", () => {
    const onChange = jest.fn();
    render(<RichTextField id="d" label="Description" value="" onChange={onChange} />);

    const editor = screen.getByRole("textbox", { name: /description/i });
    editor.innerHTML = "<b>hi</b>";
    fireEvent.input(editor);

    expect(onChange).toHaveBeenCalledWith("<b>hi</b>");
  });
});
