import { isChildCareer } from "./careerHierarchy";

export type ColumnMode = "Show per stage" | "Show per sub-stage";

export interface FormattedStage {
  label: string;
  stageId: string;
  substageId?: string;
  isDropped?: boolean;
  parentStageLabel?: string;
}

// Stage/substage descriptors built by getReportStages and carried in ColumnVisibility.
// `candidates`/`droppedCandidates` stay loosely typed — they mirror untyped API data
// and the report only ever reads `.length` on them.
export interface SubstageDescriptor {
  label: string;
  stageId: string;
  substageId: string;
  candidates: any[];
  droppedCandidates: any[];
  enabled: boolean;
}

export interface StageDescriptor {
  label: string;
  stageId: string;
  enabled: boolean;
  substages: SubstageDescriptor[];
}

export interface ColumnVisibility {
  type: ColumnMode;
  includeDroppedCandidates: boolean;
  stages: StageDescriptor[];
  offerStages: StageDescriptor[];
  /** JIA-431 "Others" columns (Created Date / Headcount / Notes) → shown? */
  otherColumns?: Record<string, boolean>;
}

// Port of the original inline getStages(). Pure: builds stage/offerStage descriptors
// (with substages carrying candidates/droppedCandidates) from the fetched careers.
export function getReportStages(careers: any[]): { stages: StageDescriptor[]; offerStages: StageDescriptor[] } {
  const stages: StageDescriptor[] = [];
  const offerStages: StageDescriptor[] = [];
  careers.forEach((item: any) => {
    item.timelineStages.forEach((stage: any) => {
      const existingStage = stages.find((s) => s.label === stage.name);
      const pushParent = (target: StageDescriptor[]) => {
        const parentStage: StageDescriptor = { label: stage.name, stageId: stage.id, enabled: true, substages: [] };
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
      } else if (["4"].includes(stage.id)) {
        // Offer-stage entry already exists: merge any NEW substages a later career
        // introduces (mirror of the stages merge below). Without this branch a
        // Job Offer substage first seen on a later career never got a column and
        // its candidates were uncounted in per-sub-stage mode.
        const idx = offerStages.findIndex((s) => s.stageId === stage.id);
        if (idx !== -1) {
          const merged = { ...offerStages[idx] };
          for (const substage of stage.substages) {
            const label = `${stage.name} - ${substage.name}`;
            if (!merged.substages.find((s) => s.label === label)) {
              merged.substages.push({
                label, stageId: stage.id, substageId: substage.id,
                candidates: substage.candidates, droppedCandidates: substage.droppedCandidates, enabled: true,
              });
            }
          }
          offerStages[idx] = merged;
        }
      } else if (!["1", "2", "3", "4"].includes(stage.id) && !existingStage) {
        pushParent(stages);
      } else if (!["4"].includes(stage.id) && existingStage) {
        const idx = stages.findIndex((s) => s.label === stage.name);
        if (idx !== -1) {
          const merged = { ...stages[idx] };
          for (const substage of stage.substages) {
            const label = `${stage.name} - ${substage.name}`;
            if (!merged.substages.find((s) => s.label === label)) {
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
      stage.substages.forEach((substage) => {
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

export interface ReportRowMeta { career: any; depth: 0 | 1; childCount: number; parentId?: string; childCareers?: any[]; }

// Groups child careers (parentCareerID) under their parent. Standalone careers and
// orphan children (parent not in result set) render at depth 0. Matches parent by id or _id.
export function groupByParentChild(careers: any[]): ReportRowMeta[] {
  // Index careers by BOTH id and _id up front (O(n) instead of a find() per child).
  // First occurrence wins per key, matching the original first-match find() semantics.
  const byKey = new Map<string, any>();
  for (const c of careers) {
    for (const k of [String(c.id), String(c._id)]) {
      if (!byKey.has(k)) byKey.set(k, c);
    }
  }
  const childrenByParent = new Map<string, any[]>();
  const top: any[] = [];
  for (const c of careers) {
    const pk = c.parentCareerID ? String(c.parentCareerID) : null;
    const parent = pk ? byKey.get(pk) : null;
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
    rows.push({ career: p, depth: 0, childCount: kids.length, childCareers: kids });
    for (const k of kids) rows.push({ career: k, depth: 1, childCount: 0, parentId: String(p.id) });
  }
  return rows;
}

// JIA-431 "Combine data from Child and Parent Post": merge the pipeline data of a
// parent and its children so the parent row shows the full funnel (e.g. CV Screening
// -> Job Offer) spanning the family. Unions stages by name and substages by name,
// concatenating candidates / droppedCandidates. Returns a timelineStages-shaped array.
export function combineTimelineStages(careers: any[]): any[] {
  const stageMap = new Map<string, any>();
  const stageOrder: string[] = [];
  for (const c of careers || []) {
    for (const st of c?.timelineStages || []) {
      if (!stageMap.has(st.name)) {
        stageMap.set(st.name, { id: st.id, name: st.name, subMap: new Map(), subOrder: [] as string[] });
        stageOrder.push(st.name);
      }
      const S = stageMap.get(st.name);
      for (const sub of st.substages || []) {
        if (!S.subMap.has(sub.name)) {
          S.subMap.set(sub.name, { id: sub.id, name: sub.name, candidates: [], droppedCandidates: [] });
          S.subOrder.push(sub.name);
        }
        const SS = S.subMap.get(sub.name);
        SS.candidates = SS.candidates.concat(sub.candidates || []);
        SS.droppedCandidates = SS.droppedCandidates.concat(sub.droppedCandidates || []);
      }
    }
  }
  return stageOrder.map((name) => {
    const S = stageMap.get(name);
    return { id: S.id, name: S.name, substages: S.subOrder.map((sn: string) => S.subMap.get(sn)) };
  });
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

// JIA-431: Created Date uses a RELATIVE time format (e.g. "10d ago"), not an absolute date.
export function relativeTimeShort(input: any): string {
  if (!input) return "-";
  const t = new Date(input).getTime();
  if (isNaN(t)) return "-";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  if (day < 30) return `${Math.floor(day / 7)}w ago`;
  if (day < 365) return `${Math.floor(day / 30)}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}

// Value for the JIA-431 "Others" columns. Created Date = relative time; Notes/Headcount gracefully default.
export function getExtraColumnValue(career: any, key: ExtraColumnKey): string {
  if (key === "Headcount") return career.headcount != null && career.headcount !== "" ? String(career.headcount) : "-";
  if (key === "Notes") return career.notes ?? "-";
  if (key === "Created Date") return relativeTimeShort(career.createdAt);
  return "-";
}
