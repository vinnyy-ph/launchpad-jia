import { isChildCareer } from "./careerHierarchy";

export type ColumnMode = "Show per stage" | "Show per sub-stage";

export interface FormattedStage {
  label: string;
  stageId: string;
  substageId?: string;
  isDropped?: boolean;
  parentStageLabel?: string;
}

export interface ColumnVisibility {
  type: ColumnMode;
  includeDroppedCandidates: boolean;
  stages: any[];
  offerStages: any[];
}

// Port of the original inline getStages(). Pure: builds stage/offerStage descriptors
// (with substages carrying candidates/droppedCandidates) from the fetched careers.
export function getReportStages(careers: any[]): { stages: any[]; offerStages: any[] } {
  const stages: any[] = [];
  const offerStages: any[] = [];
  careers.forEach((item: any) => {
    item.timelineStages.forEach((stage: any) => {
      const existingStage = stages.find((s) => s.label === stage.name);
      const pushParent = (target: any[]) => {
        const parentStage: any = { label: stage.name, stageId: stage.id, enabled: true, substages: [] };
        stage.substages.forEach((substage: any) => {
          parentStage.substages.push({
            label: `${stage.name} - ${substage.name}`,
            stageId: stage.id,
            substageId: substage.id,
            candidates: substage.candidates,
            droppedCandidates: substage.droppedCandidates,
            enabled: true,
          });
        });
        target.push(parentStage);
      };
      if (["1", "2", "3"].includes(stage.id) && !existingStage) {
        pushParent(stages);
      } else if (["4"].includes(stage.id) && !offerStages.find((s) => s.stageId === stage.id)) {
        pushParent(offerStages);
      } else if (!["1", "2", "3", "4"].includes(stage.id) && !existingStage) {
        pushParent(stages);
      } else if (!["4"].includes(stage.id) && existingStage) {
        const idx = stages.findIndex((s) => s.label === stage.name);
        if (idx !== -1) {
          const merged = { ...stages[idx] };
          for (const substage of stage.substages) {
            const label = `${stage.name} - ${substage.name}`;
            if (!merged.substages.find((s: any) => s.label === label)) {
              merged.substages.push({
                label, stageId: stage.id, substageId: substage.id,
                candidates: substage.candidates, droppedCandidates: substage.droppedCandidates, enabled: true,
              });
            }
          }
          stages[idx] = merged;
        }
      }
    });
  });
  return { stages, offerStages };
}

const isPerStage = (type: string) => type === "Show per stage";

// Port of getTableData() lines 296-339 (column descriptor building). Pure.
export function getFormattedStages(columnVisibility: ColumnVisibility): FormattedStage[] {
  const formattedStages: FormattedStage[] = [];
  const allStages = [...columnVisibility.stages, ...columnVisibility.offerStages];
  if (isPerStage(columnVisibility.type)) {
    allStages.forEach((stage) => {
      if (formattedStages.find((s) => s.label === stage.label) || !stage.enabled) return;
      formattedStages.push({ label: stage.label, stageId: stage.stageId });
      if (columnVisibility.includeDroppedCandidates) {
        formattedStages.push({ label: `Dropped from ${stage.label}`, stageId: stage.stageId, isDropped: true });
      }
    });
  } else {
    allStages.forEach((stage) => {
      stage.substages.forEach((substage: any) => {
        if (formattedStages.find((s) => s.label === substage.label) || !substage.enabled) return;
        formattedStages.push({ label: substage.label, stageId: stage.stageId, substageId: substage.substageId, parentStageLabel: stage.label });
        if (columnVisibility.includeDroppedCandidates) {
          formattedStages.push({ label: `Dropped from ${substage.label}`, stageId: stage.stageId, substageId: substage.substageId, isDropped: true, parentStageLabel: stage.label });
        }
      });
    });
  }
  return formattedStages;
}

// Port of getStageData() lines 363-392, made pure by taking `type` explicitly. Pure.
export function getStageCounts(formattedStages: FormattedStage[], item: any, type: string): Record<string, number> {
  if (isPerStage(type)) {
    return Object.fromEntries(formattedStages.map((stage) => {
      const existingStage = item.timelineStages.find(
        (s: any) => s.name === stage.label || `Dropped from ${s.name}` === stage.label
      );
      return [
        stage.label,
        existingStage?.substages?.reduce(
          (acc: number, sub: any) => acc + (stage.isDropped ? sub.droppedCandidates.length : sub.candidates.length), 0
        ) || 0,
      ];
    }));
  }
  return Object.fromEntries(formattedStages.map((stage) => {
    let existingSubstage: any;
    item.timelineStages.forEach((s: any) => {
      if (s.name === stage.parentStageLabel) {
        existingSubstage = s.substages.find(
          (sub: any) => `${s.name} - ${sub.name}` === stage.label || `Dropped from ${s.name} - ${sub.name}` === stage.label
        );
      }
    });
    return [stage.label, existingSubstage?.[stage.isDropped ? "droppedCandidates" : "candidates"]?.length || 0];
  }));
}

export interface ReportRowMeta { career: any; depth: 0 | 1; childCount: number; parentId?: string; }

// Groups child careers (parentCareerID) under their parent. Standalone careers and
// orphan children (parent not in result set) render at depth 0. Matches parent by id or _id.
export function groupByParentChild(careers: any[]): ReportRowMeta[] {
  const keyOf = (c: any) => [String(c.id), String(c._id)];
  const childrenByParent = new Map<string, any[]>();
  const top: any[] = [];
  for (const c of careers) {
    const pk = c.parentCareerID ? String(c.parentCareerID) : null;
    const parent = pk ? careers.find((p) => keyOf(p).includes(pk)) : null;
    if (isChildCareer(c) && parent && parent !== c) {
      const gid = String(parent.id);
      if (!childrenByParent.has(gid)) childrenByParent.set(gid, []);
      childrenByParent.get(gid)!.push(c);
    } else {
      top.push(c);
    }
  }
  const rows: ReportRowMeta[] = [];
  for (const p of top) {
    const kids = childrenByParent.get(String(p.id)) || [];
    rows.push({ career: p, depth: 0, childCount: kids.length });
    for (const k of kids) rows.push({ career: k, depth: 1, childCount: 0, parentId: String(p.id) });
  }
  return rows;
}

// Builds the query params for GET /api/get-pipeline-report. The 5 ticket filters
// (project, job title=careers, job owner, status, hiring manager) all map + compose here.
export function buildPipelineReportParams(
  filterStatus: any,
  opts: { orgID: string | null; projectId?: string; page: number; limit: number; sortBy: string; fullReport?: boolean }
): Record<string, any> {
  const { orgID, projectId, page, limit, sortBy, fullReport = false } = opts;
  return {
    orgID, limit, page, sortBy,
    status: filterStatus["Published Status"].join(","),
    projectIds: projectId ? projectId : filterStatus.projects.map((p: any) => p._id).join(","),
    activityStatus: filterStatus["Activity Status"].join(","),
    jobPostType: filterStatus["Subscription Plan"].join(","),
    careers: filterStatus.careers.map((c: any) => c.id).join(","),
    jobOwners: filterStatus.jobOwners.map((j: any) => j.email).filter(Boolean).join(","),
    contributors: filterStatus.contributors.map((c: any) => c.email).filter(Boolean).join(","),
    hiringManagers: filterStatus.hiringManagers.map((h: any) => h.email).filter(Boolean).join(","),
    ...(fullReport ? { fullReport: true } : {}),
  };
}

export type ExtraColumnKey = "Headcount" | "Created Date" | "Notes";

// Value for the JIA-431 "Others" columns. Created Date formatted; Notes/Headcount gracefully default.
export function getExtraColumnValue(career: any, key: ExtraColumnKey): string {
  if (key === "Headcount") return career.headcount != null && career.headcount !== "" ? String(career.headcount) : "-";
  if (key === "Notes") return career.notes ?? "-";
  if (key === "Created Date") {
    if (!career.createdAt) return "-";
    return new Date(career.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }
  return "-";
}
