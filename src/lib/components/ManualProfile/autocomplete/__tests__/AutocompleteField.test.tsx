import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import AutocompleteField from "../AutocompleteField";
import type { Suggestion } from "../fetchers";

function DummyIcon(props: { className?: string }) {
  return <svg data-testid="fallback-icon" className={props.className} />;
}

const SUGGESTIONS: Suggestion[] = [
  { key: "google.com-0", name: "Google", domain: "google.com", logoUrl: "https://logo/google" },
  { key: "gofundme.com-1", name: "GoFundMe", domain: "gofundme.com", logoUrl: "https://logo/gofundme" },
];

function Harness({
  fetcher,
  onSelect = jest.fn(),
  showMeta = false,
}: {
  fetcher: (q: string, signal: AbortSignal) => Promise<Suggestion[]>;
  onSelect?: (s: { name: string; domain: string; logoUrl: string }) => void;
  showMeta?: boolean;
}) {
  const [entry, setEntry] = useState({ name: "", domain: "", logoUrl: "" });
  return (
    <AutocompleteField
      label="Company"
      placeholder="E.g. Google"
      value={entry.name}
      domain={entry.domain}
      logoUrl={entry.logoUrl}
      onTextChange={(name) => setEntry({ name, domain: "", logoUrl: "" })}
      onSelect={(selection) => {
        onSelect(selection);
        setEntry(selection);
      }}
      fetcher={fetcher}
      fallbackIcon={DummyIcon}
      showMeta={showMeta}
    />
  );
}

function typeQuery(value: string) {
  const input = screen.getByLabelText(/company/i);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  return input;
}

describe("AutocompleteField", () => {
  it("calls onTextChange as the user types", () => {
    const onTextChange = jest.fn();
    render(
      <AutocompleteField
        label="Company"
        placeholder="E.g. Google"
        value=""
        onTextChange={onTextChange}
        onSelect={jest.fn()}
        fetcher={jest.fn().mockResolvedValue([])}
        fallbackIcon={DummyIcon}
      />,
    );
    fireEvent.change(screen.getByLabelText(/company/i), { target: { value: "go" } });
    expect(onTextChange).toHaveBeenCalledWith("go");
  });

  it("does not search for queries shorter than 2 characters", async () => {
    const fetcher = jest.fn().mockResolvedValue(SUGGESTIONS);
    render(<Harness fetcher={fetcher} />);
    typeQuery("g");
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("debounces, fetches and renders suggestions", async () => {
    const fetcher = jest.fn().mockResolvedValue(SUGGESTIONS);
    render(<Harness fetcher={fetcher} />);
    typeQuery("go");
    expect(await screen.findByText("Google")).toBeInTheDocument();
    expect(screen.getByText("GoFundMe")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith("go", expect.any(AbortSignal));
  });

  it("fills the field via onSelect when a suggestion is clicked", async () => {
    const onSelect = jest.fn();
    const fetcher = jest.fn().mockResolvedValue(SUGGESTIONS);
    render(<Harness fetcher={fetcher} onSelect={onSelect} />);
    typeQuery("go");
    fireEvent.click(await screen.findByText("Google"));

    expect(onSelect).toHaveBeenCalledWith({
      name: "Google",
      domain: "google.com",
      logoUrl: "https://logo/google",
    });
    await waitFor(() =>
      expect(screen.queryByText("GoFundMe")).not.toBeInTheDocument(),
    );
  });

  it("shows the empty state when there are no results", async () => {
    const fetcher = jest.fn().mockResolvedValue([]);
    render(<Harness fetcher={fetcher} />);
    typeQuery("zz");
    expect(await screen.findByText("No results found.")).toBeInTheDocument();
  });

  it("renders suggestion meta when showMeta is set", async () => {
    const schools: Suggestion[] = [
      { key: "k", name: "Ateneo De Manila University", domain: "ateneo.edu", meta: "Philippines" },
    ];
    const fetcher = jest.fn().mockResolvedValue(schools);
    render(<Harness fetcher={fetcher} showMeta />);
    typeQuery("at");
    expect(await screen.findByText("Ateneo De Manila University")).toBeInTheDocument();
    expect(screen.getByText("Philippines")).toBeInTheDocument();
  });
});
