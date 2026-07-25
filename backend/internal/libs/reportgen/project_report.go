package reportgen

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"golang-todo/internal/libs/ai"
	"golang-todo/internal/libs/mcpclient"
	"golang-todo/internal/models"
)

type ProjectReportData struct {
	ProjectName      string                       `json:"projectName"`
	Description      string                       `json:"description"`
	Stage            string                       `json:"stage"`
	OwnerDivisiKode  int                          `json:"ownerDivisiKode"`
	DivisionProgress []models.DivisionProgress    `json:"divisionProgress"`
	StageHistory     []models.ProjectStageHistory `json:"stageHistory"`
}

func GenerateProjectReport(ctx context.Context, agenticClient *ai.AgenticClient, project *models.Project, divProgress []models.DivisionProgress, styleNotes string) (string, error) {
	mcp, err := mcpclient.Start(ctx, nodeBin, mcpServerScript)
	if err != nil {
		return "", fmt.Errorf("gagal menjalankan MCP pptxgen: %w", err)
	}
	defer mcp.Close()

	reportData := ProjectReportData{
		ProjectName:      project.Name,
		Description:      project.Description,
		Stage:            string(project.Stage),
		OwnerDivisiKode:  project.OwnerDivisiKode,
		DivisionProgress: divProgress,
		StageHistory:     project.StageHistory,
	}

	dataJSON, err := json.MarshalIndent(reportData, "", "  ")
	if err != nil {
		return "", err
	}

	outputPath := fmt.Sprintf("/tmp/project-report-%d.pptx", time.Now().UnixNano())

	styleInstruction := "Gunakan tema korporat modern dan elegan yang profesional (primary #1E293B, accent #2563EB, background #FFFFFF, textColor #0F172A, mutedColor #64748B)."
	if styleNotes != "" {
		styleInstruction = fmt.Sprintf("Preferensi desain dari user: %q.", styleNotes)
	}

	systemPrompt := "Kamu adalah seorang presentation designer profesional. " +
		"TIDAK PERNAH mengatur posisi elemen manual (tanpa x/y/w/h) - pilih TEMPLATE LAYOUT " +
		"lewat build_slide_from_layout dan isi kontennya.\n\n" +
		"ALUR WAJIB:\n" +
		"1. Panggil create_presentation di awal, tentukan theme - " + styleInstruction + "\n" +
		"2. Buat slide: title_cover -> stat_cards (progres divisi) -> content_columns (histori stage & detail) -> closing.\n" +
		"3. Panggil save_presentation persis dengan outputPath yang diberikan."

	userPrompt := fmt.Sprintf(
		"Buatkan laporan presentasi project %s dalam format .pptx. Simpan hasil ke outputPath: %s\n\nData Project (JSON):\n%s",
		project.Name, outputPath, string(dataJSON),
	)

	executor := func(ctx context.Context, name string, argsJSON string) (string, error) {
		return mcp.CallTool(ctx, name, json.RawMessage(argsJSON))
	}

	result, err := agenticClient.RunAgentLoop(ctx, systemPrompt, userPrompt, pptxTools, executor, "save_presentation", 40)
	if err != nil {
		return "", fmt.Errorf("gagal membangun presentasi project: %w", err)
	}

	var parsed struct {
		OutputPath string `json:"outputPath"`
	}
	if jsonErr := json.Unmarshal([]byte(result), &parsed); jsonErr != nil || parsed.OutputPath == "" {
		if _, statErr := os.Stat(outputPath); statErr == nil {
			return outputPath, nil
		}
		return "", fmt.Errorf("gagal membaca path presentasi hasil: %v", jsonErr)
	}

	if _, statErr := os.Stat(parsed.OutputPath); statErr != nil {
		return "", fmt.Errorf("file presentasi tidak ditemukan di %s", parsed.OutputPath)
	}
	return parsed.OutputPath, nil
}
