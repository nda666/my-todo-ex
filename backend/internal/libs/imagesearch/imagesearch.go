package imagesearch

import "strings"

// DivisionIcon berisi ikon dan warna yang relevan untuk sebuah divisi,
// ditentukan dari kata kunci di namanya. Deterministic - nama yang sama selalu hasilnya sama.
type DivisionIcon struct {
	IconKey string // dikirim ke frontend, di-map jadi komponen ikon antd di sana
	Color   string // hex warna latar
}

var keywordIconMap = []struct {
	Keywords []string
	IconKey  string
	Color    string
}{
	{[]string{"it", "teknologi", "engineer", "developer", "programmer", "sistem"}, "laptop", "#3b82f6"},
	{[]string{"keuangan", "finance", "akuntan", "akunting", "accounting"}, "wallet", "#10b981"},
	{[]string{"sdm", "hr", "human resource", "personalia", "kepegawaian"}, "team", "#f59e0b"},
	{[]string{"marketing", "pemasaran", "promosi", "brand"}, "megaphone", "#ec4899"},
	{[]string{"legal", "hukum", "compliance"}, "scale", "#8b5cf6"},
	{[]string{"operasional", "operation", "ops", "produksi", "logistik"}, "gear", "#64748b"},
	{[]string{"sales", "penjualan"}, "chart", "#ef4444"},
	{[]string{"desain", "design", "kreatif", "creative"}, "brush", "#06b6d4"},
	{[]string{"customer", "layanan", "support", "cs"}, "headset", "#14b8a6"},
	{[]string{"gudang", "warehouse", "inventory"}, "box", "#a16207"},
}

// GetDivisionIcon menentukan ikon & warna berdasarkan kata kunci dalam nama divisi.
// Kalau tidak ada kata kunci yang cocok, fallback ke ikon default dengan warna
// yang tetap konsisten berdasarkan hash sederhana dari nama (supaya divisi yang
// sama selalu dapat warna yang sama, bukan acak tiap request).
func GetDivisionIcon(nama string) DivisionIcon {
	lower := strings.ToLower(nama)
	for _, entry := range keywordIconMap {
		for _, kw := range entry.Keywords {
			if strings.Contains(lower, kw) {
				return DivisionIcon{IconKey: entry.IconKey, Color: entry.Color}
			}
		}
	}
	return DivisionIcon{IconKey: "building", Color: fallbackColor(nama)}
}

var fallbackPalette = []string{"#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#64748b", "#ef4444", "#06b6d4"}

func fallbackColor(seed string) string {
	sum := 0
	for _, c := range seed {
		sum += int(c)
	}
	return fallbackPalette[sum%len(fallbackPalette)]
}
