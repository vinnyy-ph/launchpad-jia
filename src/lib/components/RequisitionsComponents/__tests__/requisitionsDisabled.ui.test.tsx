import React from "react";
import { render, screen } from "@testing-library/react";

import EmployerRequisitions from "../index";

jest.mock("../Table/useRequisitionsTable", () => {
  return {
    useRequisitionsTable: () => ({
      requisitions: [
        {
          id: "req_1",
          positionName: "QA Engineer",
          referenceNo: "REF-001",
          dateSubmitted: "Just now",
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
        },
      ],
      isLoading: false,
      error: null,
      fetchRequisitions: jest.fn(),
      refetchRequisitions: jest.fn(),
    }),
  };
});

describe("EmployerRequisitions - requisitions disabled", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      "activeOrg",
      JSON.stringify({ _id: "org_1", guestPortalEnabled: false, projectsEnabled: true })
    );
  });

  it("shows disabled banner and disables per-row actions dropdown", () => {
    render(<EmployerRequisitions />);

    expect(
      screen.getByText(/Requisitions are disabled for this organization\./i)
    ).toBeInTheDocument();

    const actionsButton = screen.getByRole("button", { name: /more actions/i });
    expect(actionsButton).toBeDisabled();
  });
});
