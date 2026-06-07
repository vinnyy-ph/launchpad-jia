import {
  getApplicantsFilter, getApplicantsSort, buildApplicantsPipeline,
} from "../careerFetchPipelines";

const stageNames = (p: any[]) => p.map((s) => Object.keys(s)[0]);

describe("getApplicantsFilter", () => {
  it("always filters by careerID", () => {
    expect(getApplicantsFilter("c1", null, null, null, null)).toEqual({ id: "c1" });
  });
  it("maps All Statuses / Ongoing / Invited / literal", () => {
    expect(getApplicantsFilter("c1", null, null, null, "All Statuses").applicationStatus)
      .toEqual({ $in: ["Ongoing", "Dropped", "Hired", "Cancelled", null] });
    expect(getApplicantsFilter("c1", null, null, null, "Ongoing").applicationStatus)
      .toEqual({ $in: ["Ongoing", null] });
    expect(getApplicantsFilter("c1", null, null, null, "Invited").invitedFrom)
      .toEqual({ $exists: true, $ne: null });
    expect(getApplicantsFilter("c1", null, null, null, "Hired").applicationStatus).toBe("Hired");
  });
  it("composes search + stage + substage", () => {
    const f = getApplicantsFilter("c1", "ann", "s1", "ss1", null);
    expect(f.name).toEqual({ $regex: "ann", $options: "i" });
    expect(f.stageId).toBe("s1");
    expect(f.substageId).toBe("ss1");
  });
});

describe("getApplicantsSort", () => {
  it("maps every named sort and defaults to _id desc", () => {
    expect(getApplicantsSort("Recent Activity")).toEqual({ updatedAt: -1, _id: -1 });
    expect(getApplicantsSort("Oldest Activity")).toEqual({ updatedAt: 1, _id: -1 });
    expect(getApplicantsSort("Date Applied (Newest First)")).toEqual({ createdAt: -1, _id: -1 });
    expect(getApplicantsSort("Date Applied (Oldest First)")).toEqual({ createdAt: 1, _id: -1 });
    expect(getApplicantsSort("Alphabetical (A-Z)")).toEqual({ nameLower: 1, _id: -1 });
    expect(getApplicantsSort("Alphabetical (Z-A)")).toEqual({ nameLower: -1, _id: -1 });
    expect(getApplicantsSort(null)).toEqual({ _id: -1 });
  });
});

describe("buildApplicantsPipeline", () => {
  const pipeline = buildApplicantsPipeline({
    filter: { id: "c1" }, sort: { updatedAt: -1, _id: -1 }, page: 3, limit: 10,
  });

  it("paginates BEFORE the evaluations lookup (the perf fix)", () => {
    const names = stageNames(pipeline);
    expect(names.indexOf("$limit")).toBeLessThan(names.indexOf("$lookup"));
    expect(names.indexOf("$skip")).toBeLessThan(names.indexOf("$lookup"));
    expect(names.indexOf("$sort")).toBeLessThan(names.indexOf("$skip"));
  });

  it("normalizes sort keys before sorting (mixed string/Date safe)", () => {
    const names = stageNames(pipeline);
    const addFieldsIdx = names.indexOf("$addFields");
    expect(addFieldsIdx).toBeGreaterThan(-1);
    expect(addFieldsIdx).toBeLessThan(names.indexOf("$sort"));
    const af = (pipeline[addFieldsIdx] as any).$addFields;
    expect(af.nameLower).toEqual({ $toLower: "$name" });
    expect(af.updatedAt).toEqual({ $toDate: "$updatedAt" });
    expect(af.createdAt).toEqual({ $toDate: "$createdAt" });
  });

  it("computes skip from page", () => {
    expect(pipeline.find((s: any) => "$skip" in s)).toEqual({ $skip: 20 });
    expect(pipeline.find((s: any) => "$limit" in s)).toEqual({ $limit: 10 });
  });

  it("keeps the original output field list", () => {
    const project = (pipeline.filter((s: any) => "$project" in s).pop() as any).$project;
    for (const f of ["_id","interviewID","name","image","nameLower","email","applicationStatus",
      "currentStep","status","updatedAt","createdAt","cvStatus","jobFit",
      "cvScreeningEvaluation","cvScreeningReason","summary","stageId","substageId"]) {
      expect(project[f]).toBe(1);
    }
  });

  it("keeps the evaluations lookup semantics (Endorsed/Dropped switch, latest-first, limit 1)", () => {
    const lookup = (pipeline.find((s: any) => "$lookup" in s) as any).$lookup;
    expect(lookup.from).toBe("recruiter-evaluations");
    expect(lookup.let.status.$cond.if).toEqual({ $ne: ["$applicationStatus", "Dropped"] });
    expect(lookup.pipeline).toContainEqual({ $sort: { createdAt: -1 } });
    expect(lookup.pipeline).toContainEqual({ $limit: 1 });
    const last = pipeline[pipeline.length - 1];
    expect(last).toEqual({ $addFields: { currentEvaluation: { $arrayElemAt: ["$evaluations", 0] } } });
  });
});
