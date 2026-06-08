import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

import RecruiterPipelineReport from "../RecruiterPipelineReport";
import { api } from "@/lib/utils/apiClient";

// ---- Mocks: navigation, data layer, and heavy sibling components. The pure
// pipeline utils and TableMetric render for real — the point of this test is the
// fetch -> aggregate -> render -> toggle -> export wiring (refactors/t3 R9).

jest.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (key: string) => (key === "orgID" ? "ORG1" : null) }),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/lib/utils/apiClient", () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

jest.mock("@/lib/Utils", () => ({
  errorToast: jest.fn(),
  successToast: jest.fn(),
}));

jest.mock("@/lib/hooks/filterSortDefaults/usePipelineReportViewPreferences", () => ({
  usePipelineReportViewPreferences: () => ({
    isViewStateReady: true,
    isSetAsDefault: false,
    isSetAsDefaultLoading: false,
    handleSetAsDefaultChange: jest.fn(),
  }),
}));

jest.mock("@/lib/components/Dropdown/MultiFilterDropdown", () => ({
  __esModule: true,
  default: () => null,
}));

// Renders every option as a plain button so tests can trigger "Export as CSV".
jest.mock("@/lib/components/Dropdown/CustomDropdown", () => ({
  __esModule: true,
  default: ({ options, setValue }: { options?: string[]; setValue: (v: string) => void }) => (
    <div>
      {options?.map((option) => (
        <button key={option} type="button" onClick={() => setValue(option)}>
          {option}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/lib/components/DataTables/CareersTableV2", () => ({
  JobOwner: ({ career }: { career: any }) => (
    <span>{career?.teamMembers?.find((m: any) => m.role === "Job Owner")?.name ?? "owner"}</span>
  ),
}));

jest.mock("@/lib/components/CareerComponents/CareerStatusBadge", () => ({
  __esModule: true,
  default: () => <span>status</span>,
}));

jest.mock("@/lib/components/CareerComponents/FullScreenLoadingAnimation", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/lib/Loader/TableLoader", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/lib/components/AnalyticsComponents/NoDataAvailable", () => ({
  __esModule: true,
  default: () => <div>No data available</div>,
}));

jest.mock("react-tooltip", () => ({
  Tooltip: () => null,
}));

// ---- Fixture: parent (with one child) + standalone career. Combined parent row
// (JIA-431): CV Screening = parent (2+1) + child 1 = 4; Job Offer = 3.

const sub = (id: string, name: string, candidates: number, dropped = 0) => ({
  id,
  name,
  candidates: Array.from({ length: candidates }, () => ({})),
  droppedCandidates: Array.from({ length: dropped }, () => ({})),
});

const baseCareer = (over: any = {}) => ({
  status: "active",
  activityStatus: "Active",
  jobPostType: "premium",
  headcount: "2",
  createdAt: "2026-05-01T00:00:00.000Z",
  notes: "",
  teamMembers: [{ role: "Job Owner", name: "Owner A", email: "a@x.com" }],
  createdBy: { name: "Owner A", email: "a@x.com" },
  ...over,
});

const parentCareer = baseCareer({
  id: "p1",
  _id: "pid1",
  jobTitle: "Parent Role",
  projectName: "Proj X",
  timelineStages: [
    { id: "1", name: "CV Screening", substages: [sub("1", "Waiting Submission", 2, 1), sub("2", "For Review", 1)] },
    { id: "4", name: "Job Offer", substages: [sub("1", "For Final Review", 3)] },
  ],
});

const childCareer = baseCareer({
  id: "c1",
  _id: "cid1",
  jobTitle: "Child Role",
  projectName: "Proj X",
  parentCareerID: "p1",
  timelineStages: [
    { id: "1", name: "CV Screening", substages: [sub("1", "Waiting Submission", 1)] },
  ],
});

const loneCareer = baseCareer({
  id: "s1",
  _id: "sid1",
  jobTitle: "Standalone Role",
  projectName: "Proj Y",
  timelineStages: [
    { id: "1", name: "CV Screening", substages: [sub("1", "Waiting Submission", 5)] },
  ],
});

const FIXTURE = { data: { careers: [parentCareer, childCareer, loneCareer], totalCareers: 3 } };

// Header order is fixed: # | Job Title | Project | Job Owner | Status | ...stages.
const STAGE_CELL_OFFSET = 5;

const cellsOf = (rowText: string) => {
  const row = screen.getByText(rowText).closest("tr")!;
  return within(row).getAllByRole("cell").map((c) => c.textContent);
};

const renderReport = async () => {
  render(<RecruiterPipelineReport />);
  await screen.findByText("Parent Role");
};

const openCustomizeColumns = () => {
  fireEvent.click(screen.getByText("Customize Columns"));
  return screen.getByText("Apply");
};

beforeEach(() => {
  localStorage.clear();
  (api.get as jest.Mock).mockReset().mockResolvedValue(FIXTURE);
});

describe("RecruiterPipelineReport (fetch -> render -> toggle -> export wiring)", () => {
  it("renders per-stage columns with parent rows combining parent+child counts", async () => {
    await renderReport();
    expect(screen.getByText("CV Screening")).toBeInTheDocument();
    expect(screen.getByText("Job Offer")).toBeInTheDocument();
    // Parent row: CV Screening 2+1 (own) + 1 (child) = 4, Job Offer = 3.
    expect(cellsOf("Parent Role").slice(STAGE_CELL_OFFSET)).toEqual(["4", "3"]);
    expect(cellsOf("Standalone Role").slice(STAGE_CELL_OFFSET)).toEqual(["5", "0"]);
    // Children are collapsed by default.
    expect(screen.queryByText("Child Role")).not.toBeInTheDocument();
  });

  it("expands and collapses child rows via the chevron, mouse and keyboard", async () => {
    await renderReport();
    const chevron = screen.getByRole("button", { name: "Expand child posts" });
    expect(chevron).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(chevron);
    expect(await screen.findByText("Child Role")).toBeInTheDocument();
    // Keyboard path (R7): Enter on the now-"Collapse" chevron hides the child again.
    const collapse = screen.getByRole("button", { name: "Collapse child posts" });
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(collapse, { key: "Enter" });
    await waitFor(() => expect(screen.queryByText("Child Role")).not.toBeInTheDocument());
  });

  it("switches to per-sub-stage columns through Customize Columns", async () => {
    await renderReport();
    const apply = openCustomizeColumns();
    fireEvent.click(screen.getByText("Show per sub-stage"));
    fireEvent.click(apply);
    expect(await screen.findByText("CV Screening - Waiting Submission")).toBeInTheDocument();
    expect(screen.getByText("CV Screening - For Review")).toBeInTheDocument();
    expect(screen.queryByText(/^CV Screening$/)).not.toBeInTheDocument();
    // Parent row per-sub-stage: WS 2+1=3, FR 1, Job Offer FFR 3.
    expect(cellsOf("Parent Role").slice(STAGE_CELL_OFFSET)).toEqual(["3", "1", "3"]);
  });

  it("adds Dropped columns when the dropped toggle is applied", async () => {
    await renderReport();
    const apply = openCustomizeColumns();
    const toggle = screen
      .getByText("Show dropped per stage")
      .closest("div")!.parentElement!.querySelector("input")!;
    fireEvent.click(toggle);
    fireEvent.click(apply);
    expect(await screen.findByText("Dropped from CV Screening")).toBeInTheDocument();
    // Parent row: CV 4, Dropped-CV 1 (parent's 1 + child's 0), Job Offer 3, Dropped-Offer 0.
    expect(cellsOf("Parent Role").slice(STAGE_CELL_OFFSET)).toEqual(["4", "1", "3", "0"]);
  });

  it("closes the Customize Columns modal on Escape", async () => {
    await renderReport();
    openCustomizeColumns();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByText("Apply")).not.toBeInTheDocument());
  });

  it("exports CSV with the shared fullReport query and absolute ISO dates", async () => {
    await renderReport();
    // Enable the Created Date column so the export carries a date cell.
    const apply = openCustomizeColumns();
    const createdDate = screen.getByText("Created Date").closest("div")!.querySelector("input")!;
    fireEvent.click(createdDate);
    fireEvent.click(apply);
    await screen.findByText("Created Date");

    const appendSpy = jest.spyOn(document.body, "appendChild");
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    fireEvent.click(screen.getByText("Export as CSV"));

    await waitFor(() => {
      expect(appendSpy.mock.calls.some(([node]) => node instanceof HTMLAnchorElement)).toBe(true);
    });
    // The export fetch goes through buildPipelineReportParams with fullReport (R2).
    const exportCall = (api.get as jest.Mock).mock.calls.at(-1)!;
    expect(exportCall[1].params).toMatchObject({ orgID: "ORG1", fullReport: true });

    const anchor = appendSpy.mock.calls
      .map(([node]) => node)
      .find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement)!;
    const csv = decodeURIComponent(anchor.getAttribute("href")!.split(",").slice(1).join(","));
    expect(csv).toContain("Parent Role");
    expect(csv).toContain("Child Role"); // full report includes collapsed children
    expect(csv).toContain("2026-05-01"); // ISO Created Date (R12), not "ago"
    expect(csv).not.toMatch(/\bago\b/);

    appendSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
