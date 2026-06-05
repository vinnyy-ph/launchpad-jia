import {
  EXCLUDE_ARCHIVED,
  ARCHIVE_MATCH_STAGE,
  withExcludeArchived,
  archivedConstraint,
  selectInterviewIdsToDrop,
  planArchiveTargets,
  archiveCareerPatch,
  undoCareerUpdate,
} from "@/lib/utils/careerArchive";

describe("careerArchive query helpers", () => {
  it("EXCLUDE_ARCHIVED matches non-archived docs", () => {
    expect(EXCLUDE_ARCHIVED).toEqual({ archived: { $ne: true } });
  });

  it("ARCHIVE_MATCH_STAGE wraps the exclude in a $match", () => {
    expect(ARCHIVE_MATCH_STAGE).toEqual({ $match: { archived: { $ne: true } } });
  });

  it("withExcludeArchived merges without dropping existing keys", () => {
    expect(withExcludeArchived({ orgID: "o1", status: "active" })).toEqual({
      orgID: "o1",
      status: "active",
      archived: { $ne: true },
    });
  });

  it("archivedConstraint shows only archived when 'archived' selected", () => {
    expect(archivedConstraint(["archived"])).toEqual({ archived: true });
    expect(archivedConstraint(["active", "archived"])).toEqual({ archived: true });
  });

  it("archivedConstraint excludes archived otherwise", () => {
    expect(archivedConstraint([])).toEqual({ archived: { $ne: true } });
    expect(archivedConstraint(["active"])).toEqual({ archived: { $ne: true } });
  });
});

describe("selectInterviewIdsToDrop", () => {
  // "Hired stage" = applicationStatus "Hired" (per get-careers / get-career-applicants),
  // not a pipeline substage. Drop everyone not Hired and not already Dropped.
  const interviews = [
    { _id: "i1", applicationStatus: "Ongoing" }, // drop
    { _id: "i2", applicationStatus: "Hired" }, // keep
    { _id: "i3", applicationStatus: null }, // ongoing/unknown -> drop
    { _id: "i4", applicationStatus: "Dropped" }, // already dropped -> skip
    { _id: "i5" }, // missing status -> drop
  ];

  it("drops everyone not Hired and not already Dropped", () => {
    expect(selectInterviewIdsToDrop(interviews as any)).toEqual(["i1", "i3", "i5"]);
  });

  it("keeps Hired candidates", () => {
    expect(selectInterviewIdsToDrop([{ _id: "h", applicationStatus: "Hired" }] as any)).toEqual([]);
  });

  it("is empty-safe", () => {
    expect(selectInterviewIdsToDrop([])).toEqual([]);
  });
});

describe("planArchiveTargets", () => {
  it("includes the parent and all its children", () => {
    const parent = { _id: "p", id: "P1" };
    const children = [{ _id: "c1", id: "C1" }, { _id: "c2", id: "C2" }];
    expect(planArchiveTargets(parent as any, children as any)).toEqual(["p", "c1", "c2"]);
  });

  it("returns just the parent when no children", () => {
    expect(planArchiveTargets({ _id: "p", id: "P1" } as any, [])).toEqual(["p"]);
  });
});

describe("archiveCareerPatch", () => {
  it("captures prior status + stamps batch", () => {
    const p = archiveCareerPatch({ status: "active", activityStatus: "Active" }, { batchId: "b1", by: "me@x.com", at: new Date(0) });
    expect(p).toMatchObject({ archived: true, status: "inactive", activityStatus: "Inactive", statusBeforeArchive: "active", activityStatusBeforeArchive: "Active", archiveBatchId: "b1", archivedBy: "me@x.com" });
  });
});

describe("undoCareerUpdate", () => {
  it("restores prior status and clears archive fields", () => {
    const u = undoCareerUpdate({ status: "inactive", activityStatus: "Inactive", statusBeforeArchive: "active", activityStatusBeforeArchive: "Active" });
    expect(u.$set).toMatchObject({ archived: false, status: "active", activityStatus: "Active" });
    expect(u.$unset).toHaveProperty("archiveBatchId");
    expect(u.$unset).toHaveProperty("statusBeforeArchive");
  });
  it("falls back to current status when no prior captured", () => {
    const u = undoCareerUpdate({ status: "inactive", activityStatus: "Inactive" });
    expect(u.$set.status).toBe("inactive");
  });
});
