// backend/internal/libs/ai/theme.go
package ai

import "strings"

// ReportTheme adalah spesifikasi visual konkret yang dikirim ke generator PPTX.
// Desain slide tetap dikontrol kode (Go + generate.js) - ini cuma preset warna/font
// yang dipilih berdasarkan kata kunci gaya yang diminta user, bukan hasil ngarang AI.
type ReportTheme struct {
	Name       string `json:"name"`
	Primary    string `json:"primary"`    // warna utama (header, accent bar)
	Secondary  string `json:"secondary"`  // warna sekunder (progress bar, highlight)
	Background string `json:"background"` // warna latar slide
	TextColor  string `json:"textColor"`
	MutedColor string `json:"mutedColor"` // warna teks sekunder/label
	FontFamily string `json:"fontFamily"`
}

var themePresets = map[string]ReportTheme{
	"elegant_minimal": {
		Name: "elegant_minimal", Primary: "1F2937", Secondary: "6B7280",
		Background: "FFFFFF", TextColor: "111827", MutedColor: "9CA3AF", FontFamily: "Georgia",
	},
	"corporate_blue": {
		Name: "corporate_blue", Primary: "1D4ED8", Secondary: "3B82F6",
		Background: "FFFFFF", TextColor: "1E293B", MutedColor: "64748B", FontFamily: "Calibri",
	},
	"dark_mode": {
		Name: "dark_mode", Primary: "38BDF8", Secondary: "818CF8",
		Background: "0F172A", TextColor: "F1F5F9", MutedColor: "94A3B8", FontFamily: "Calibri",
	},
	"vibrant": {
		Name: "vibrant", Primary: "F97316", Secondary: "EC4899",
		Background: "FFFFFF", TextColor: "1F2937", MutedColor: "6B7280", FontFamily: "Calibri",
	},
	"pastel": {
		Name: "pastel", Primary: "A78BFA", Secondary: "F9A8D4",
		Background: "FDF4FF", TextColor: "3F3F46", MutedColor: "A1A1AA", FontFamily: "Verdana",
	},
}

// DetectTheme memilih preset berdasarkan kata kunci pada styleNotes (bebas Indonesia/Inggris).
// Default ke corporate_blue kalau tidak ada kata kunci yang cocok atau styleNotes kosong.
func DetectTheme(styleNotes string) ReportTheme {
	s := strings.ToLower(styleNotes)

	switch {
	case containsAny(s, "elegan", "elegant", "minimalis", "minimal", "simple", "sederhana", "clean", "formal"):
		return themePresets["elegant_minimal"]
	case containsAny(s, "dark mode", "gelap", "dark"):
		return themePresets["dark_mode"]
	case containsAny(s, "colorful", "ramai", "rame", "vibrant", "cerah", "meriah"):
		return themePresets["vibrant"]
	case containsAny(s, "pastel", "lembut", "soft"):
		return themePresets["pastel"]
	default:
		return themePresets["corporate_blue"]
	}
}

func containsAny(s string, keywords ...string) bool {
	for _, k := range keywords {
		if strings.Contains(s, k) {
			return true
		}
	}
	return false
}
