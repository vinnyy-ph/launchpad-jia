import { fireEvent, render, screen } from "@testing-library/react";
import CvUploadBanner from "../CvUploadBanner";

describe("CvUploadBanner", () => {
  it("renders the prompt copy", () => {
    render(<CvUploadBanner onUploadCv={jest.fn()} onDismiss={jest.fn()} />);
    expect(screen.getByText("Already have a CV?")).toBeInTheDocument();
    expect(
      screen.getByText(/parse and auto-fill your profile/i),
    ).toBeInTheDocument();
  });

  it("calls onUploadCv when the Upload CV button is clicked", () => {
    const onUploadCv = jest.fn();
    render(<CvUploadBanner onUploadCv={onUploadCv} onDismiss={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /upload cv/i }));

    expect(onUploadCv).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when the close button is clicked", () => {
    const onDismiss = jest.fn();
    render(<CvUploadBanner onUploadCv={jest.fn()} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
