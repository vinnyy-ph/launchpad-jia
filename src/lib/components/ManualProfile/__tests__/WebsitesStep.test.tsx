import { fireEvent, render, screen } from "@testing-library/react";
import WebsitesStep, { createWebsite } from "../WebsitesStep";
import type { ContactWebsite } from "@/lib/utils/structuredCV";

function ws(partial: Partial<ContactWebsite> = {}): ContactWebsite {
  return { id: partial.id ?? "a", url: partial.url ?? "", type: partial.type ?? "" };
}

describe("WebsitesStep", () => {
  it("labels an entry by index when no type is set and shows the https:// prefix", () => {
    render(<WebsitesStep value={[ws({ id: "a" })]} onChange={jest.fn()} />);
    expect(screen.getByText("Website 1")).toBeInTheDocument();
    expect(screen.getByText("https://")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("www.website.com")).toBeInTheDocument();
  });

  it("labels an entry by its selected type", () => {
    render(<WebsitesStep value={[ws({ id: "a", type: "Portfolio" })]} onChange={jest.fn()} />);
    expect(screen.getByText("Website: Portfolio")).toBeInTheDocument();
  });

  it("collapses an entry when its header is clicked", () => {
    render(<WebsitesStep value={[ws({ id: "a" })]} onChange={jest.fn()} />);
    expect(screen.getByPlaceholderText("www.website.com")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /website 1/i }));

    expect(screen.queryByPlaceholderText("www.website.com")).not.toBeInTheDocument();
  });

  it("removes an entry via its delete button", () => {
    const onChange = jest.fn();
    render(
      <WebsitesStep value={[ws({ id: "a" }), ws({ id: "b" })]} onChange={onChange} />,
    );

    const deleteButtons = screen.getAllByRole("button", { name: /delete website/i });
    fireEvent.click(deleteButtons[0]);

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: "b" })]);
  });

  it("createWebsite returns an empty entry with a unique id", () => {
    const a = createWebsite();
    const b = createWebsite();
    expect(a).toEqual(expect.objectContaining({ url: "", type: "" }));
    expect(a.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });
});
