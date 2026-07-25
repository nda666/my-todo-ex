export type ProjectStage =
  | 'PLANNING'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'REJECTED'
  | 'ON_HOLD'
  | 'CANCELLED'
  | 'DONE';

export const STAGE_LABELS: Record<ProjectStage, string> = {
  PLANNING: 'Planning',
  IN_PROGRESS: 'In Progress',
  REVIEW: 'Review',
  REJECTED: 'Rejected',
  ON_HOLD: 'On Hold',
  CANCELLED: 'Cancelled',
  DONE: 'Done',
};

export const STAGE_COLORS: Record<ProjectStage, string> = {
  PLANNING: 'blue',
  IN_PROGRESS: 'processing',
  REVIEW: 'warning',
  REJECTED: 'error',
  ON_HOLD: 'default',
  CANCELLED: 'volcano',
  DONE: 'success',
};

export interface ProjectStageHistory {
  id: string;
  fromStage: ProjectStage;
  toStage: ProjectStage;
  changedBy: string;
  changedAt: string;
  note?: string | null;
}

export interface DivisionProgress {
  divisiKode: number;
  divisiNama: string;
  totalTasks: number;
  completedTasks: number;
  percentDone: number;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  ownerDivisiKode: number;
  status: 'active' | 'archived';
  stage: ProjectStage;
  stageVersion: number;
  createdAt: string;
  divisions: number[];
  leaders: string[];
  stageHistory?: ProjectStageHistory[];
  divisionProgress?: DivisionProgress[];
}
