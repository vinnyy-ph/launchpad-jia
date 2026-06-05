import { fireEvent, render, screen } from "@testing-library/react";
import ContactInformationStep, {
  createEmptyContact,
} from "../ContactInformationStep";

function setup() {
  const onChange = jest.fn();
  render(
    <ContactInformationStep
      value={createEmptyContact("karina@gmail.com")}
      onChange={onChange}
    />,
  );
  return { onChange };
}

describe("ContactInformationStep manual address", () => {
  it("hides structured fields until the manual link is clicked", () => {
    setup();
    expect(screen.queryByLabelText(/street address/i)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /enter address manually/i }),
    );

    expect(screen.getByLabelText(/street address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city \/ municipality/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^country/i)).toBeInTheDocument();
  });

  it("composes structured fields into the address string", () => {
    const { onChange } = setup();
    fireEvent.click(
      screen.getByRole("button", { name: /enter address manually/i }),
    );

    fireEvent.change(screen.getByLabelText(/street address/i), {
      target: { value: "123 Street" },
    });

    const lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(lastCall.addressManual).toBe(true);
    expect(lastCall.address).toContain("123 Street");
  });
});
