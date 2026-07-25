package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

type TaskSummaryInput struct {
	OwnerName string `json:"ownerName"`
	Title     string `json:"title"`
	Status    string `json:"status"` // "done" | "in_progress" | "pending"
}

type ReportGroup struct {
	TargetName   string   `json:"targetName"`
	PercentDone  float64  `json:"percentDone"`
	DoneTasks    []string `json:"doneTasks"`    // sudah diformat "Nama: judul"
	PendingTasks []string `json:"pendingTasks"` // sudah diformat "Nama: judul"
}

type groupingResult struct {
	Groups []ReportGroup `json:"groups"`
}

// GroupTasksForReport mengirim daftar task ke LLM untuk dikelompokkan berdasarkan
// target/proyek yang disebut di judul/deskripsi task, lalu hitung persentase selesainya.
// Desain slide TETAP dikontrol kode Go - LLM hanya bertugas mengelompokkan data, bukan membuat visual.
// backend/internal/libs/ai/grouping.go — hanya signature GroupTasksForReport & pemanggilan client.Complete yang berubah
func GroupTasksForReport(ctx context.Context, client Client, sessionId string, tasks []TaskSummaryInput) ([]ReportGroup, error) {
	var sb strings.Builder
	sb.WriteString("Kelompokkan daftar task berikut berdasarkan target/proyek/aplikasi yang disebut di judulnya ")
	sb.WriteString("(misal task yang menyebut 'Aplikasi POS' masuk grup 'Aplikasi POS'). ")
	sb.WriteString("Task yang tidak menyebut target jelas, masukkan ke grup 'Umum'. ")
	sb.WriteString("Hitung percentDone = (jumlah task status done / total task grup) * 100, dibulatkan ke bilangan bulat terdekat. ")
	sb.WriteString("Balas HANYA dengan JSON valid persis format ini, tanpa teks lain, tanpa markdown code block:\n")
	sb.WriteString(`{"groups":[{"targetName":"...","percentDone":90,"doneTasks":["Nama: judul task"],"pendingTasks":["Nama: judul task"]}]}` + "\n\n")
	sb.WriteString("Data task:\n")
	for _, t := range tasks {
		sb.WriteString(fmt.Sprintf("- [%s] %s: %s\n", t.Status, t.OwnerName, t.Title))
	}

	reply, err := client.Complete(ctx, []ChatMessage{
		{Role: "system", Content: "Kamu adalah alat pengelompokan data. Balas hanya JSON valid, tidak ada teks lain."},
		{Role: "user", Content: sb.String()},
	}, sessionId)
	if err != nil {
		return nil, err
	}

	cleaned := strings.TrimSpace(reply)
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")

	var result groupingResult
	if err := json.Unmarshal([]byte(cleaned), &result); err != nil {
		return nil, fmt.Errorf("gagal memproses pengelompokan task: %w", err)
	}
	return result.Groups, nil
}
