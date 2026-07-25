import { getToken } from './auth';

const CLOUDINARY_CLOUD_NAME = "adha-bakhtiar";
const CLOUDINARY_UPLOAD_PRESET = "temp_upload";

export interface CloudinaryUploadResult {
  url: string;
  fileName: string;
  fileType: string;
  sizeBytes: number;
}

// Dipakai untuk lampiran komentar & info tambahan task (unsigned, langsung dari browser ke Cloudinary)
export async function uploadToCloudinary(
  file: File,
): Promise<CloudinaryUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
    { method: "POST", body: formData },
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(errBody?.error?.message || "Upload gagal, coba lagi.");
  }

  const data = await res.json();
  return {
    url: data.public_id,
    fileName: file.name,
    fileType: file.type,
    sizeBytes: file.size,
  };
}

// Dipakai khusus avatar - upload lewat backend (signed, server-side) supaya API secret gak kebuka di client
export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload-avatar", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(errText || "Gagal mengunggah avatar.");
  }

  return res.json();
}
