package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"golang-todo/internal/auth"
	"golang-todo/internal/models"
	"golang-todo/internal/repository"
)

type CreateWebhookTokenRequest struct {
	Name        string `json:"name"`
	CustomToken string `json:"custom_token"`
}

func generateRandomToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return "wtk_" + hex.EncodeToString(b)
}

func WebhookTokenHandler(repos *repository.Repositories) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, err := auth.RequireUser(r.Context())
		if err != nil {
			http.Error(w, "unauthorized: silakan login terlebih dahulu", http.StatusUnauthorized)
			return
		}

		ctx := r.Context()

		switch r.Method {
		case http.MethodGet:
			var tokens []models.WebhookToken
			if err := repos.DB.WithContext(ctx).
				Where("user_kode = ?", claims.Kodeku).
				Order("created_at DESC").
				Find(&tokens).Error; err != nil {
				http.Error(w, "gagal mengambil daftar token: "+err.Error(), http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
				"data":    tokens,
			})

		case http.MethodPost:
			var req CreateWebhookTokenRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}

			name := strings.TrimSpace(req.Name)
			if name == "" {
				name = "Git Hook Token"
			}

			tokenStr := strings.TrimSpace(req.CustomToken)
			if tokenStr == "" {
				tokenStr = generateRandomToken()
			} else {
				if len(tokenStr) < 4 {
					http.Error(w, "custom token minimal 4 karakter", http.StatusBadRequest)
					return
				}
			}

			// Cek apakah token sudah digunakan
			var existingCount int64
			repos.DB.WithContext(ctx).Model(&models.WebhookToken{}).Where("token = ?", tokenStr).Count(&existingCount)
			if existingCount > 0 {
				http.Error(w, "token tersebut sudah digunakan, gunakan token kustom yang lain", http.StatusBadRequest)
				return
			}

			tokenRecord := models.WebhookToken{
				UserKode:   claims.Kodeku,
				DivisiKode: claims.KodeDivisi,
				Name:       name,
				Token:      tokenStr,
			}

			if err := repos.DB.WithContext(ctx).Create(&tokenRecord).Error; err != nil {
				http.Error(w, "gagal menyimpan webhook token: "+err.Error(), http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
				"message": "Token webhook berhasil dibuat",
				"data":    tokenRecord,
			})

		case http.MethodDelete:
			idStr := r.URL.Query().Get("id")
			if idStr == "" {
				var body struct {
					ID uint `json:"id"`
				}
				if err := json.NewDecoder(r.Body).Decode(&body); err == nil && body.ID > 0 {
					idStr = strconv.Itoa(int(body.ID))
				}
			}

			id, parseErr := strconv.Atoi(idStr)
			if parseErr != nil || id <= 0 {
				http.Error(w, "parameter id tidak valid", http.StatusBadRequest)
				return
			}

			delRes := repos.DB.WithContext(ctx).
				Where("id = ? AND user_kode = ?", id, claims.Kodeku).
				Delete(&models.WebhookToken{})

			if delRes.Error != nil {
				http.Error(w, "gagal menghapus token: "+delRes.Error.Error(), http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
				"message": "Token webhook berhasil dihapus",
			})

		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}
