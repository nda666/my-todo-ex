package httpapi

import (
	"encoding/json"
	"net/http"

	"golang-todo/internal/auth"
	"golang-todo/internal/libs/cloudinaryup"
	"golang-todo/internal/repository"
)

func UploadAvatarHandler(repos *repository.Repositories) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		claims, err := auth.RequireUser(r.Context())
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		if err := r.ParseMultipartForm(10 << 20); err != nil {
			http.Error(w, "file terlalu besar atau form tidak valid", http.StatusBadRequest)
			return
		}

		file, _, err := r.FormFile("file")
		if err != nil {
			http.Error(w, "file tidak ditemukan", http.StatusBadRequest)
			return
		}
		defer file.Close()

		url, err := cloudinaryup.UploadAvatar(r.Context(), file, claims.Kodeku)
		if err != nil {
			http.Error(w, "gagal upload: "+err.Error(), http.StatusInternalServerError)
			return
		}

		if err := repos.Profile.UpsertAvatar(r.Context(), claims.Kodeku, url); err != nil {
			http.Error(w, "gagal simpan profil: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"avatarUrl": url})
	}
}
