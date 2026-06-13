import { fireEvent, render, screen } from "@testing-library/react";
import CvUploadModal from "../CvUploadModal";

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

describe("CvUploadModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <CvUploadModal opened={false} onClose={jest.fn()} onFile={jest.fn()} parsing={false} error={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("fires onFile when a file is chosen", async () => {
    const onFile = jest.fn();
    render(<CvUploadModal opened onClose={jest.fn()} onFile={onFile} parsing={false} error={null} />);
    // Wait for the modal to become visible before interacting.
    await screen.findByRole("button", { name: /cancel/i });
    const file = new File(["x"], "cv.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput(), { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("shows a parsing state", async () => {
    render(<CvUploadModal opened onClose={jest.fn()} onFile={jest.fn()} parsing error={null} />);
    expect(await screen.findByText(/reading your cv/i)).toBeInTheDocument();
  });

  it("shows an error message", async () => {
    render(<CvUploadModal opened onClose={jest.fn()} onFile={jest.fn()} parsing={false} error="Bad file" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Bad file");
  });
});
