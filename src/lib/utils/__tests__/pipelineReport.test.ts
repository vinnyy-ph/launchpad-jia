import {
  getReportStages, getFormattedStages, getStageCounts,
  groupByParentChild, buildPipelineReportParams, getExtraColumnValue,
  combineTimelineStages, relativeTimeShort, csvEscape,
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

  // Was a pinned gap (see refactors/t3/recommendations.md R1), fixed in the deferred-
  // cleanup session: a NEW Job Offer substage introduced by a later career now merges
  // into the existing offerStages entry, so its column appears and its candidates count.
  it("merges new offer-stage substages from later careers into the existing entry", () => {
    const c2 = career({ timelineStages: [
      { id: "4", name: "Job Offer", substages: [
        { id: "9", name: "Negotiation", candidates: [{}], droppedCandidates: [] },
      ] },
    ] });
    const { offerStages } = getReportStages([career(), c2]);
    expect(offerStages).toHaveLength(1);
    expect(offerStages[0].substages.map((s: any) => s.label)).toEqual([
      "Job Offer - For Final Review", "Job Offer - Negotiation",
    ]);
    // and it does not duplicate substages both careers share
    const { offerStages: again } = getReportStages([career(), career()]);
    expect(again[0].substages.map((s: any) => s.label)).toEqual(["Job Offer - For Final Review"]);
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
    expect((rows[0].childCareers || []).map((c: any) => c.jobTitle)).toEqual(["Child"]);
  });
  it("treats an orphan child (parent absent) as depth 0", () => {
    const orphan = career({ id: "o1", parentCareerID: "missing" });
    const rows = groupByParentChild([orphan]);
    expect(rows).toHaveLength(1);
    expect(rows[0].depth).toBe(0);
  });
  it("matches the parent by _id as well as id, preserving child order", () => {
    const parent = career({ id: "p1", _id: "PID", jobTitle: "Parent" });
    const a = career({ id: "a", _id: "aid", jobTitle: "A", parentCareerID: "PID" });
    const b = career({ id: "b", _id: "bid", jobTitle: "B", parentCareerID: "p1" });
    const rows = groupByParentChild([parent, a, b]);
    expect(rows.map((r) => [r.career.jobTitle, r.depth])).toEqual([
      ["Parent", 0], ["A", 1], ["B", 1],
    ]);
    expect(rows[0].childCount).toBe(2);
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
  it("drops member entries with a missing email instead of emitting empty segments", () => {
    const p = buildPipelineReportParams(
      { ...fs, jobOwners: [{ email: "a@x.com" }, { name: "No Email" }] },
      { orgID: "O", page: 1, limit: 20, sortBy: "x" }
    );
    expect(p.jobOwners).toBe("a@x.com");
  });
});

describe("getExtraColumnValue", () => {
  it("Created Date is relative time; headcount passed through; notes default to '-'", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 864e5).toISOString();
    expect(getExtraColumnValue(career({ createdAt: threeDaysAgo }), "Created Date")).toBe("3d ago");
    expect(getExtraColumnValue(career({ headcount: "5" }), "Headcount")).toBe("5");
    expect(getExtraColumnValue(career({ notes: undefined }), "Notes")).toBe("-");
    expect(getExtraColumnValue(career({ notes: "urgent req" }), "Notes")).toBe("urgent req");
  });
});

describe("csvEscape (RFC-4180)", () => {
  it("passes plain fields through unquoted", () => {
    expect(csvEscape("Engineer")).toBe("Engineer");
    expect(csvEscape(42)).toBe("42");
    expect(csvEscape("-")).toBe("-");
  });
  it("quote-wraps fields containing commas, quotes, or line breaks", () => {
    expect(csvEscape("Senior, Staff Engineer")).toBe('"Senior, Staff Engineer"');
    expect(csvEscape('the "best" role')).toBe('"the ""best"" role"');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
    expect(csvEscape("line1\r\nline2")).toBe('"line1\r\nline2"');
  });
  it("renders null/undefined as an empty string", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });
});

describe("relativeTimeShort (JIA-431 Created Date format)", () => {
  it("formats deltas as compact relative strings", () => {
    expect(relativeTimeShort(new Date(Date.now() - 30 * 1000))).toBe("just now");
    expect(relativeTimeShort(new Date(Date.now() - 5 * 60 * 1000))).toBe("5m ago");
    expect(relativeTimeShort(new Date(Date.now() - 3 * 3600 * 1000))).toBe("3h ago");
    expect(relativeTimeShort(new Date(Date.now() - 2 * 864e5))).toBe("2d ago");
    expect(relativeTimeShort(new Date(Date.now() - 14 * 864e5))).toBe("2w ago");
    expect(relativeTimeShort(new Date(Date.now() - 60 * 864e5))).toBe("2mo ago");
    expect(relativeTimeShort(null)).toBe("-");
    expect(relativeTimeShort("not-a-date")).toBe("-");
  });
  it("clamps future dates to 'just now' (clock-skewed createdAt must not render negative)", () => {
    expect(relativeTimeShort(new Date(Date.now() + 60 * 1000))).toBe("just now");
  });
});

describe("combineTimelineStages (JIA-431 parent+child combine)", () => {
  it("unions stages/substages and concatenates candidates across the family", () => {
    const parent = career(); // CV Screening (Waiting Submission 2) + Job Offer (For Final Review 3)
    const child = career({ timelineStages: [
      { id: "1", name: "CV Screening", substages: [
        { id: "1", name: "Waiting Submission", candidates: [{}], droppedCandidates: [] },
      ] },
      { id: "3", name: "Human Interview", substages: [
        { id: "3", name: "For Review", candidates: [{}, {}], droppedCandidates: [] },
      ] },
    ] });
    const combined = combineTimelineStages([parent, child]);
    const byName: any = Object.fromEntries(combined.map((s: any) => [s.name, s]));
    const ws = byName["CV Screening"].substages.find((s: any) => s.name === "Waiting Submission");
    expect(ws.candidates.length).toBe(3); // parent 2 + child 1
    expect(byName["Human Interview"]).toBeTruthy(); // child-only stage merged in
    expect(byName["Job Offer"]).toBeTruthy(); // parent-only stage retained
    // combined per-stage count usable by getStageCounts via a synthetic career
    const counts = getStageCounts(
      getFormattedStages(colVis({ stages: getReportStages([parent, child]).stages, offerStages: getReportStages([parent, child]).offerStages })),
      { timelineStages: combined }, "Show per stage"
    );
    expect(counts["CV Screening"]).toBe(4); // WS 3 + For Review 1
  });
});
