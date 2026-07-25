// frontend/src/types/dora.ts
export interface DoraMessage {
  role: "user" | "assistant";
  content: string;
}

export interface DoraTaskItem {
  title: string;
  description: string;
  targetUserKode: string;
}

export interface DoraDivisionCandidate {
  kode: number;
  nama: string;
}

export interface DoraSuggestedAction {
  type: string;
  title: string;
  description: string;
  targetUserKode: string;
  startDate?: string;
  endDate?: string;
  styleNotes?: string;
  tasks?: DoraTaskItem[];
  divisions?: number[];
  divisionCandidates?: DoraDivisionCandidate[];
}

export interface DoraResponse {
  reply: string;
  suggestedAction: DoraSuggestedAction | null;
}
