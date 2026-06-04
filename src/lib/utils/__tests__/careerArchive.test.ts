import {
  EXCLUDE_ARCHIVED,
  ARCHIVE_MATCH_STAGE,
  withExcludeArchived,
  archivedConstraint,
  resolveHiredSubstageId,
  selectInterviewIdsToDrop,
  planArchiveTargets,
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

describe("resolveHiredSubstageId", () => {
  const finalStage = {
    id: "job-offer",
    type: "core",
    substages: [
      { id: "1", name: "For Final Review" },
      { id: "4", name: "Hired" },
    ],
  };

  it("finds the Hired substage by name", () => {
    expect(resolveHiredSubstageId([{ id: "cv" }, finalStage] as any)).toBe("4");
  });

  it("falls back to '4' when no Hired substage name present", () => {
    expect(resolveHiredSubstageId([{ id: "cv", substages: [] }] as any)).toBe("4");
  });

  it("is undefined-safe", () => {
    expect(resolveHiredSubstageId(undefined)).toBe("4");
  });
});

describe("selectInterviewIdsToDrop", () => {
  const hiredId = "4";
  const interviews = [
    { _id: "i1", substageId: "1" }, // not hired -> drop
    { _id: "i2", substageId: "4" }, // hired -> keep
    { _id: "i3", substageId: undefined }, // not hired -> drop
    { _id: "i4", applicationStatus: "Dropped", substageId: "1" }, // already dropped -> skip
  ];

  it("selects only non-Hired, not-already-dropped interviews", () => {
    expect(selectInterviewIdsToDrop(interviews as any, hiredId)).toEqual(["i1", "i3"]);
  });

  it("is empty-safe", () => {
    expect(selectInterviewIdsToDrop([], hiredId)).toEqual([]);
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
