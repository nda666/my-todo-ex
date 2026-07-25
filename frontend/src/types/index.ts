export interface Jabatan {
  kode: number;
  nama: string;
}

export interface Divisi {
  kode: number;
  nama: string;
}

export interface Pegawai {
  kode: number;
  nama: string;
  kodejabatan: number;
  kodedivisi: number;
  jabatan?: Jabatan | null;
  divisi?: Divisi | null;
}

export interface User {
  kodeku: string;
  username: string;
  pegawai?: Pegawai | null;
}

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface TaskComment {
  id: string;
  content: string;
  userKode: string;
  createdAt: string;
}

export interface TaskMeta {
  id: string;
  key: string;
  value?: string | null;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  comments?: TaskComment[] | null;
  meta?: TaskMeta[] | null;
}
