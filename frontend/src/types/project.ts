export type ProjectStage =
  | 'PLANNING'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'REJECTED'
  | 'ON_HOLD'
  | 'CANCELLED'
  | 'DONE';

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
