import { getToken } from "./auth";

export async function downloadTeamReport(
  startDate: string,
  endDate: string,
  sessionId: string,
  styleNotes?: string,
) {
  const token = getToken();
  const params = new URLSearchParams({
    start: startDate,
    end: endDate,
    session_id: sessionId,
  });
  if (styleNotes) params.set("style", styleNotes);

  const res = await fetch(`/api/reports/team-summary?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Gagal membuat laporan.");
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Laporan-Progres-Tim.pptx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
