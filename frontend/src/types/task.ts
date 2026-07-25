export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";
export type SubtaskStatus = "PENDING" | "COMPLETED";
export type MetaType = "TEXT" | "LINK" | "COLOR" | "DATE" | "FILE" | "IMAGE";

export interface Jabatan {
  kode: number;
  nama: string;
}

export interface Divisi {
  kode: number;
  nama: string;
}
export interface DivisionSummary {
  kode: number;
  nama: string;
  leaderName: string | null;
  memberCount: number;
  iconKey: string; // <-- ganti avatarUrl
  color: string; // <-- baru
}

export interface Pegawai {
  kode: number;
  nama: string;
  kodejabatan: number;
  kodedivisi: number;
  statusLeader: number;
  jabatan?: Jabatan | null;
  divisi?: Divisi | null;
}

export interface Me {
  kodeku: string;
  username: string;
  avatarUrl?: string | null;
  pegawai?: Pegawai | null;
}

export interface Colleague {
  kodeku: string;
  nama: string;
  statusLeader: number;
  avatarUrl?: string | null;
  jabatan?: Jabatan | null;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  reacted: boolean;
}

export interface CommentAttachment {
  id: string;
  url: string;
  fileName: string;
  fileType: string | null;
  sizeBytes: number;
}

export interface TaskComment {
  id: string;
  content: string;
  userKode: string;
  createdAt: string;
  parentId: string | null;
  replies: TaskComment[];
  reactions: ReactionSummary[];
  attachments: CommentAttachment[];
}

export interface TaskMeta {
  id: string;
  key: string;
  value: string | null;
  type: MetaType;
  sortOrder: number;
}

export interface Subtask {
  id: string;
  taskId: string;
  description: string;
  status: SubtaskStatus;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  userKode: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  sortOrder: number;
  comments: TaskComment[];
  meta: TaskMeta[];
  subtasks?: Subtask[];
}

export interface TaskConnection {
  tasks: Task[];
  nextCursor: string | null;
  hasMore: boolean;
}

// Dipakai saat compose task baru / edit info tambahan, sebelum tersimpan ke server
// ...semua yang lain tetap sama, cuma ini yang berubah:
export interface MetaDraft {
  draftId: string;
  id?: string; // ID asli di database, ada kalau item ini sudah tersimpan (dipakai saat edit)
  key: string;
  value: string;
  type: MetaType;
}
