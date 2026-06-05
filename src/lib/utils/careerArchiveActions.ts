import { api } from "@/lib/utils/apiClient";

export async function archiveCareerRequest(id: string, dropCandidates: boolean) {
  const res = await api.post("/api/archive-career", { id, dropCandidates });
  return res.data;
}

export async function restoreCareerRequest(id: string) {
  const res = await api.post("/api/restore-career", { id });
  return res.data;
}
