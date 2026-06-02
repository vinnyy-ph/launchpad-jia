export interface CandidateCard {
  id: string;
  interviewID: string;
  name: string;
  email: string;
  avatar: string;
  fit?: string | null;
  endorsedBy?: string;
  endorsedByAvatar?: string | null;
  assessedBy?: string;
  timeAgo: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  cards: CandidateCard[];
}

export interface KanbanGroup {
  id: string;
  title: string;
  droppedCount: number;
  columns: KanbanColumn[];
}
