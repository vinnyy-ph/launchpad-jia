import React from "react";
import { render, screen } from "@testing-library/react";

import ViewFormModal from "../ViewFormModal";

jest.mock("../useUpdateRequisitionStatus", () => {
  return {
    useUpdateRequisitionStatus: () => ({
      updateStatus: jest.fn(),
      isUpdating: false,
    }),
  };
});

jest.mock("../useUpdateRequisition", () => {
  return {
    useUpdateRequisition: () => ({
      updateRequisition: jest.fn(),
      isUpdating: false,
    }),
  };
});

describe("ViewFormModal - requisitions disabled", () => {
  it("shows disabled banner and disables action controls", () => {
    render(
      <ViewFormModal
        onClose={jest.fn()}
        requisition={{
          id: "req_1",
          positionName: "QA Engineer",
          dateSubmitted: new Date().toISOString(),
          status: "In Review",
          submittedBy: {
            name: "Guest User",
            email: "guest@company.com",
            avatar: "",
          },
          formData: {
            positionName: "QA Engineer",
            jobDescription: "<p>Test</p>",
            headcount: "1",
            workArrangement: "Remote",
            officeLocation: { country: "Philippines", stateProvince: "NCR", city: "Makati" },
            salaryRange: { min: "1000", max: "2000", currency: "PHP" },
            employmentType: "Full-time",
            reason: "<p>Need more QA</p>",
          },
        }}
        requisitionsDisabled={true}
      />
    );

    expect(
      screen.getByText(/Requisitions are disabled for this organization\./i)
    ).toBeInTheDocument();

    const moreOptions = screen.getByRole("button", { name: /more options/i });
    expect(moreOptions).toBeDisabled();

    const approve = screen.getByRole("button", { name: /^approve$/i });
    expect(approve).toBeDisabled();
  });
});
