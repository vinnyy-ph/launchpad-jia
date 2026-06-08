import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import AddressAutocompleteField from "../AddressAutocompleteField";
import type { AddressSuggestion } from "../fetchers";

const SUGGESTIONS: AddressSuggestion[] = [
  { id: "0", displayName: "Manila, Metro Manila, Philippines" },
  { id: "1", displayName: "Makati, Metro Manila, Philippines" },
];

function Harness({
  fetcher,
  onSelect = jest.fn(),
}: {
  fetcher: (q: string, signal: AbortSignal) => Promise<AddressSuggestion[]>;
  onSelect?: (address: string) => void;
}) {
  const [address, setAddress] = useState("");
  return (
    <AddressAutocompleteField
      label="Address"
      placeholder="Search address"
      value={address}
      onTextChange={setAddress}
      onSelect={(next) => {
        onSelect(next);
        setAddress(next);
      }}
      fetcher={fetcher}
    />
  );
}

function typeQuery(value: string) {
  const input = screen.getByLabelText(/address/i);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  return input;
}

describe("AddressAutocompleteField", () => {
  it("calls onTextChange as the user types", () => {
    const onTextChange = jest.fn();
    render(
      <AddressAutocompleteField
        label="Address"
        placeholder="Search address"
        value=""
        onTextChange={onTextChange}
        onSelect={jest.fn()}
        fetcher={jest.fn().mockResolvedValue([])}
      />,
    );
    fireEvent.change(screen.getByLabelText(/address/i), { target: { value: "ma" } });
    expect(onTextChange).toHaveBeenCalledWith("ma");
  });

  it("does not search for queries shorter than 2 characters", async () => {
    const fetcher = jest.fn().mockResolvedValue(SUGGESTIONS);
    render(<Harness fetcher={fetcher} />);
    typeQuery("m");
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("debounces, fetches and renders location suggestions", async () => {
    const fetcher = jest.fn().mockResolvedValue(SUGGESTIONS);
    render(<Harness fetcher={fetcher} />);
    typeQuery("man");
    expect(
      await screen.findByText("Manila, Metro Manila, Philippines"),
    ).toBeInTheDocument();
    expect(screen.getByText("Makati, Metro Manila, Philippines")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith("man", expect.any(AbortSignal));
  });

  it("fills the field via onSelect when a suggestion is clicked", async () => {
    const onSelect = jest.fn();
    const fetcher = jest.fn().mockResolvedValue(SUGGESTIONS);
    render(<Harness fetcher={fetcher} onSelect={onSelect} />);
    typeQuery("man");
    fireEvent.click(await screen.findByText("Manila, Metro Manila, Philippines"));
    expect(onSelect).toHaveBeenCalledWith("Manila, Metro Manila, Philippines");
    await waitFor(() =>
      expect(
        screen.queryByText("Makati, Metro Manila, Philippines"),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows the empty state when there are no results", async () => {
    const fetcher = jest.fn().mockResolvedValue([]);
    render(<Harness fetcher={fetcher} />);
    typeQuery("zz");
    expect(await screen.findByText("No locations found.")).toBeInTheDocument();
  });
});
