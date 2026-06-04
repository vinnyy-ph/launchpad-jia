import {
  getReportStages, getFormattedStages, getStageCounts,
  groupByParentChild, buildPipelineReportParams, getExtraColumnValue,
} from "../pipelineReport";

const career = (over: any = {}) => ({
  id: "c1", _id: "id1", jobTitle: "Software Engineer", projectName: "Proj A",
  status: "active", activityStatus: "Active", jobPostType: "premium",
  headcount: "3", createdAt: "2026-01-10T00:00:00.000Z", notes: "hello",
  teamMembers: [{ role: "Job Owner", email: "owner@x.com", name: "Owner" }],
  createdBy: { email: "owner@x.com", name: "Owner" },
  timelineStages: [
    { id: "1", name: "CV Screening", substages: [
      { id: "1", name: "Waiting Submission", candidates: [{}, {}], droppedCandidates: [{}] },
      { id: "2", name: "For Review", candidates: [{}], droppedCandidates: [] },
    ] },
    { id: "4", name: "Job Offer", substages: [
      { id: "1", name: "For Final Review", candidates: [{}, {}, {}], droppedCandidates: [] },
    ] },
  ],
  ...over,
});

describe("getReportStages", () => {
  it("puts core stages 1-3 in stages and stage 4 in offerStages, with substages", () => {
    const { stages, offerStages } = getReportStages([career()]);
    expect(stages.map((s) => s.label)).toEqual(["CV Screening"]);
    expect(offerStages.map((s) => s.label)).toEqual(["Job Offer"]);
    expect(stages[0].substages.map((s: any) => s.label)).toEqual([
      "CV Screening - Waiting Submission", "CV Screening - For Review",
    ]);
  });

  it("merges substages across careers sharing the same stage (no duplicates)", () => {
    const c2 = career({ timelineStages: [
      { id: "1", name: "CV Screening", substages: [
        { id: "3", name: "Final Screen", candidates: [], droppedCandidates: [] },
      ] },
    ] });
    const { stages } = getReportStages([career(), c2]);
    expect(stages).toHaveLength(1);
    expect(stages[0].substages.map((s: any) => s.label)).toEqual([
      "CV Screening - Waiting Submission",
      "CV Screening - For Review",
      "CV Screening - Final Screen",
    ]);
  });
});

const colVis = (over: any = {}) => {
  const { stages, offerStages } = getReportStages([career()]);
  return { type: "Show per stage", includeDroppedCandidates: false, stages, offerStages, ...over } as any;
};

describe("getFormattedStages + getStageCounts", () => {
  it("per-stage: one column per stage, counts = sum of substage candidates", () => {
    const cv = colVis();
    const fs = getFormattedStages(cv);
    expect(fs.map((s) => s.label)).toEqual(["CV Screening", "Job Offer"]);
    const counts = getStageCounts(fs, career(), cv.type);
    expect(counts).toEqual({ "CV Screening": 3, "Job Offer": 3 });
  });

  it("per-stage + dropped: adds 'Dropped from X' columns counting droppedCandidates", () => {
    const cv = colVis({ includeDroppedCandidates: true });
    const fs = getFormattedStages(cv);
    expect(fs.map((s) => s.label)).toContain("Dropped from CV Screening");
    const counts = getStageCounts(fs, career(), cv.type);
    expect(counts["Dropped from CV Screening"]).toBe(1);
  });

  it("per-sub-stage: one column per substage with correct counts", () => {
    const cv = colVis({ type: "Show per sub-stage" });
    const fs = getFormattedStages(cv);
    expect(fs.map((s) => s.label)).toEqual([
      "CV Screening - Waiting Submission", "CV Screening - For Review", "Job Offer - For Final Review",
    ]);
    const counts = getStageCounts(fs, career(), cv.type);
    expect(counts["CV Screening - Waiting Submission"]).toBe(2);
    expect(counts["CV Screening - For Review"]).toBe(1);
    expect(counts["Job Offer - For Final Review"]).toBe(3);
  });
});

describe("groupByParentChild", () => {
  it("nests children under parent and keeps standalone at depth 0", () => {
    const parent = career({ id: "p1", _id: "pid1", jobTitle: "Parent" });
    const child = career({ id: "ch1", _id: "cid1", jobTitle: "Child", parentCareerID: "p1" });
    const lone = career({ id: "s1", _id: "sid1", jobTitle: "Standalone" });
    const rows = groupByParentChild([parent, child, lone]);
    expect(rows.map((r) => [r.career.jobTitle, r.depth])).toEqual([
      ["Parent", 0], ["Child", 1], ["Standalone", 0],
    ]);
    expect(rows[0].childCount).toBe(1);
  });
  it("treats an orphan child (parent absent) as depth 0", () => {
    const orphan = career({ id: "o1", parentCareerID: "missing" });
    const rows = groupByParentChild([orphan]);
    expect(rows).toHaveLength(1);
    expect(rows[0].depth).toBe(0);
  });
});

describe("buildPipelineReportParams", () => {
  const fs = {
    jobOwners: [{ email: "a@x.com" }], projects: [{ _id: "P1" }],
    "Published Status": ["active"], "Activity Status": [], "Subscription Plan": [],
    contributors: [], careers: [{ id: "C1" }], hiringManagers: [{ email: "h@x.com" }],
  };
  it("maps and composes all five filters", () => {
    const p = buildPipelineReportParams(fs, { orgID: "O", page: 1, limit: 20, sortBy: "Position Name (A-Z)" });
    expect(p).toMatchObject({
      orgID: "O", projectIds: "P1", careers: "C1",
      jobOwners: "a@x.com", hiringManagers: "h@x.com", status: "active",
    });
    expect(p.fullReport).toBeUndefined();
  });
  it("projectId scope overrides project filter; fullReport flag is set when requested", () => {
    const p = buildPipelineReportParams(fs, { orgID: "O", projectId: "SCOPED", page: 1, limit: 20, sortBy: "x", fullReport: true });
    expect(p.projectIds).toBe("SCOPED");
    expect(p.fullReport).toBe(true);
  });
});

describe("getExtraColumnValue", () => {
  it("formats created date, passes headcount, defaults missing notes", () => {
    expect(getExtraColumnValue(career({ createdAt: "2026-01-10T00:00:00.000Z" }), "Created Date")).toMatch(/January.*2026/);
    expect(getExtraColumnValue(career({ headcount: "5" }), "Headcount")).toBe("5");
    expect(getExtraColumnValue(career({ notes: undefined }), "Notes")).toBe("-");
  });
});
