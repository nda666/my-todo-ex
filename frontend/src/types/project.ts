export interface Project {
  id: string;
  name: string;
  description: string | null;
  ownerDivisiKode: number;
  status: "active" | "archived";
  createdAt: string;
  divisions: number[];
  leaders: string[];
}
