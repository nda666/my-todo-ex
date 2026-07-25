import { MetaType } from "../types/task";

export const META_TYPE_OPTIONS: { value: MetaType; label: string }[] = [
  { value: "TEXT", label: "Teks" },
  { value: "LINK", label: "Tautan" },
  { value: "COLOR", label: "Warna" },
  { value: "DATE", label: "Tanggal" },
  { value: "FILE", label: "Dokumen" },
  { value: "IMAGE", label: "Gambar" },
];

export const META_TYPE_LABEL: Record<MetaType, string> = {
  TEXT: "Teks",
  LINK: "Tautan",
  COLOR: "Warna",
  DATE: "Tanggal",
  FILE: "Dokumen",
  IMAGE: "Gambar",
};
