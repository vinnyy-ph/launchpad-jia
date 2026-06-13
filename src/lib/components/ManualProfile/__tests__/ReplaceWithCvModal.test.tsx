import { fireEvent, render, screen } from "@testing-library/react";
import ReplaceWithCvModal from "../ReplaceWithCvModal";

describe("ReplaceWithCvModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <ReplaceWithCvModal opened={false} onConfirm={jest.fn()} onCancel={jest.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("fires onConfirm and onCancel", async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(<ReplaceWithCvModal opened onConfirm={onConfirm} onCancel={onCancel} />);

    // The DS Modal renders its content aria-hidden until a nested rAF marks it
    // visible, so query asynchronously (matches ManualProfileWizard.test.tsx).
    fireEvent.click(await screen.findByRole("button", { name: /replace with cv/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(await screen.findByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
