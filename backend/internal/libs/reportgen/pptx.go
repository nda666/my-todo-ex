// backend/internal/libs/reportgen/pptx.go — full file
package reportgen

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"golang-todo/internal/libs/ai"
	"golang-todo/internal/libs/mcpclient"
)

var mcpServerScript = envOr("PPTXGEN_MCP_SCRIPT", "scripts/pptxgen-mcp/index.js")
var nodeBin = envOr("NODE_BIN_PATH", "node")

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

var pptxTools = []ai.ToolDef{
	{
		Name: "create_presentation",
		Description: "Membuat presentasi PowerPoint baru + set palet warna (theme) yang WAJIB dipakai konsisten di " +
			"semua slide berikutnya. WAJIB dipanggil pertama kali.",
		Parameters: json.RawMessage(`{"type":"object","properties":{
			"title":{"type":"string"},"author":{"type":"string"},
			"theme":{"type":"object","properties":{
				"primary":{"type":"string"},"accent":{"type":"string"},"background":{"type":"string"},
				"textColor":{"type":"string"},"mutedColor":{"type":"string"},
				"overlay":{"type":"string"},"overlayOpacity":{"type":"number"},"fontFace":{"type":"string"}
			},"required":["primary","accent","background","textColor","mutedColor"]}
		},"required":["title","theme"]}`),
	},
	{
		Name: "build_slide_from_layout",
		Description: "Membuat SATU slide memakai TEMPLATE LAYOUT siap pakai (posisi/grid/spacing sudah didesain " +
			"profesional) - kamu HANYA isi konten via 'props', TIDAK PERNAH kirim x/y/w/h manual.\n" +
			"Layout yang tersedia:\n" +
			"- title_cover {title,subtitle?,eyebrow?,imageSeed?}: slide judul dengan foto background\n" +
			"- section_header {title,eyebrow?,icon?:{set,name}}: divider antar-bagian\n" +
			"- stat_cards {title,cards:[{value,label,detail?,icon?,accentColor?}] (2-4 item)}: kartu statistik\n" +
			"- chart_focus {title,chartType?,labels,values,seriesName?,colors?,sidePoints?:[{label,value}]}: chart + poin ringkasan\n" +
			"- content_columns {title,columns:[{heading,items:[string],icon?,accentColor?}] (1-3 kolom)}: daftar per kategori\n" +
			"- closing {title?,subtitle?}: slide penutup\n" +
			"icon pakai format Iconify: {\"set\":\"lucide\",\"name\":\"target\"} dsb.",
		Parameters: json.RawMessage(`{"type":"object","properties":{
			"presentationId":{"type":"string"},
			"layout":{"type":"string","enum":["title_cover","section_header","stat_cards","chart_focus","content_columns","closing"]},
			"props":{"type":"object","description":"Konten sesuai skema layout yang dipilih"}
		},"required":["presentationId","layout","props"]}`),
	},
	{
		Name:        "save_presentation",
		Description: "Menyimpan presentasi ke file .pptx. WAJIB dipanggil terakhir setelah semua slide dibuat.",
		Parameters: json.RawMessage(`{"type":"object","properties":{
			"presentationId":{"type":"string"},"outputPath":{"type":"string"}
		},"required":["presentationId","outputPath"]}`),
	},
}

func Generate(ctx context.Context, agenticClient *ai.AgenticClient, periodLabel string, groups []ai.ReportGroup, styleNotes string) (string, error) {
	mcp, err := mcpclient.Start(ctx, nodeBin, mcpServerScript)
	if err != nil {
		return "", fmt.Errorf("gagal menjalankan MCP pptxgen: %w", err)
	}
	defer mcp.Close()

	groupsJSON, err := json.MarshalIndent(groups, "", "  ")
	if err != nil {
		return "", err
	}

	outputPath := fmt.Sprintf("/tmp/report-output-%d.pptx", time.Now().UnixNano())

	styleInstruction := "Tidak ada preferensi desain spesifik dari user - gunakan tema korporat biru gelap yang bersih dan profesional " +
		"(primary #1D4ED8, accent #38BDF8, background #FFFFFF, textColor #0F172A, mutedColor #64748B)."
	if styleNotes != "" {
		styleInstruction = fmt.Sprintf("Preferensi desain dari user: %q. Pilih nilai theme (primary/accent/background/textColor/mutedColor) yang mencerminkan preferensi ini.", styleNotes)
	}

	systemPrompt := "Kamu adalah seorang presentation designer profesional papan atas, setara desainer template premium di Canva. " +
		"Kamu TIDAK PERNAH mengatur posisi elemen manual (tidak ada x/y/w/h) - kamu hanya memilih TEMPLATE LAYOUT yang paling " +
		"cocok lewat build_slide_from_layout dan mengisi kontennya. Semua grid/spacing/proporsi sudah dijamin rapi oleh sistem.\n\n" +
		"ALUR WAJIB:\n" +
		"1. Panggil create_presentation SEKALI di awal, TENTUKAN palet theme (primary/accent/background/textColor/mutedColor) " +
		"yang konsisten untuk SELURUH presentasi - " + styleInstruction + "\n" +
		"2. Susun rangkaian slide dengan memvariasikan layout (JANGAN pakai layout yang sama berturut-turut lebih dari 2x) - " +
		"pola yang baik: title_cover -> stat_cards (ringkasan angka) -> chart_focus (visualisasi progres) -> " +
		"section_header (kalau ada banyak grup, sebagai divider) -> content_columns (detail task per grup, 1 slide bisa " +
		"memuat 2-3 grup sekaligus lewat kolom) -> closing.\n" +
		"3. Panggil build_slide_from_layout untuk SETIAP slide - boleh memanggil beberapa layout sekaligus dalam SATU giliran " +
		"(parallel tool calls) untuk hemat kuota API, targetkan total giliran sesedikit mungkin (idealnya 2-3 giliran total).\n" +
		"4. Akhiri dengan save_presentation persis dengan outputPath yang diberikan.\n\n" +
		"ATURAN KONTEN:\n" +
		"- stat_cards: pilih 2-4 angka paling penting (mis. total grup, rata-rata persentase selesai, jumlah task selesai vs pending).\n" +
		"- chart_focus: labels/values dari percentDone tiap target (batasi ke 6-8 target teratas kalau terlalu banyak, gabungkan sisanya sebagai 'Lainnya').\n" +
		"- content_columns: kelompokkan target-target ke kolom (maks 3 kolom per slide, kalau grup >3 buat beberapa slide content_columns berurutan).\n" +
		"- Icon Iconify yang relevan: 'target' (progres), 'check-circle' (selesai), 'clock' (pending), 'users' (tim), " +
		"'trending-up' (peningkatan), 'alert-circle' (kendala), 'trophy' (pencapaian) - set 'lucide' atau 'tabler'.\n" +
		"Jangan menjelaskan rencana dalam teks - langsung eksekusi lewat tool calls."

	userPrompt := fmt.Sprintf(
		"Buatkan laporan progres tim periode %s dalam format .pptx. Simpan hasil akhir ke outputPath: %s\n\nData progres (JSON):\n%s",
		periodLabel, outputPath, string(groupsJSON),
	)

	executor := func(ctx context.Context, name string, argsJSON string) (string, error) {
		return mcp.CallTool(ctx, name, json.RawMessage(argsJSON))
	}

	result, err := agenticClient.RunAgentLoop(ctx, systemPrompt, userPrompt, pptxTools, executor, "save_presentation", 40)
	if err != nil {
		return "", fmt.Errorf("gagal membangun presentasi: %w", err)
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
