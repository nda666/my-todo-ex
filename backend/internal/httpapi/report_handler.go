// backend/internal/httpapi/report_handler.go
package httpapi

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"golang-todo/internal/auth"
	"golang-todo/internal/libs/ai"
	"golang-todo/internal/libs/reportgen"
	"golang-todo/internal/repository"
)

func GenerateReportHandler(repos *repository.Repositories, aiClient ai.Client, agenticClient *ai.AgenticClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, err := auth.RequireUser(r.Context())
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		startStr := r.URL.Query().Get("start")
		endStr := r.URL.Query().Get("end")
		// sessionId := r.URL.Query().Get("session_id")
		styleNotes := r.URL.Query().Get("style")
		start, err1 := time.Parse("2006-01-02", startStr)
		end, err2 := time.Parse("2006-01-02", endStr)
		if err1 != nil || err2 != nil {
			http.Error(w, "parameter start/end tidak valid (format YYYY-MM-DD)", http.StatusBadRequest)
			return
		}
		end = end.Add(24*time.Hour - time.Second)

		members, err := repos.Pegawai.FindByDivisi(r.Context(), claims.ExternalToken, claims.KodeDivisi)
		if err != nil {
			http.Error(w, "gagal memuat data tim: "+err.Error(), http.StatusInternalServerError)
			return
		}
		userKodes := make([]string, len(members))
		nameByKode := make(map[string]string, len(members))
		for i, m := range members {
			kode := strconv.Itoa(m.Kode)
			userKodes[i] = kode
			nameByKode[kode] = m.Nama
		}
		nameByKode[claims.Kodeku] = claims.Fullname
		userKodes = append(userKodes, claims.Kodeku)

		tasks, err := repos.Task.FindByUserKodesInRange(r.Context(), userKodes, start, end)
		if err != nil {
			http.Error(w, "gagal memuat task: "+err.Error(), http.StatusInternalServerError)
			return
		}

		summaries := make([]ai.TaskSummaryInput, len(tasks))
		for i, t := range tasks {
			ownerName := nameByKode[t.UserKode]
			if ownerName == "" {
				ownerName = t.UserKode
			}
			status := "pending"
			if t.Status == "completed" {
				status = "done"
			} else if t.Status == "in_progress" {
				status = "in_progress"
			}
			summaries[i] = ai.TaskSummaryInput{OwnerName: ownerName, Title: t.Title, Status: status}
		}

		groups, err := ai.GroupTasksForReport(r.Context(), aiClient, claims.Kodeku, summaries)
		if err != nil {
			http.Error(w, "gagal mengelompokkan data laporan: "+err.Error(), http.StatusInternalServerError)
			return
		}

		periodLabel := fmt.Sprintf("%s - %s", start.Format("2 Jan 2006"), end.Format("2 Jan 2006"))

		outputPath, err := reportgen.Generate(r.Context(), agenticClient, periodLabel, groups, styleNotes)
		if err != nil {
			http.Error(w, "gagal membuat file presentasi: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer os.Remove(outputPath)

		w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation")
		w.Header().Set("Content-Disposition", `attachment; filename="Laporan-Progres-Tim.pptx"`)
		http.ServeFile(w, r, outputPath)
	}
}

func GenerateProjectReportHandler(repos *repository.Repositories, agenticClient *ai.AgenticClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, err := auth.RequireUser(r.Context())
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		projIDStr := r.URL.Query().Get("projectId")
		styleNotes := r.URL.Query().Get("style")
		projID, err := strconv.ParseUint(projIDStr, 10, 64)
		if err != nil || projID == 0 {
			http.Error(w, "parameter projectId tidak valid", http.StatusBadRequest)
			return
		}

		project, err := repos.Project.FindByID(r.Context(), uint(projID))
		if err != nil {
			http.Error(w, "project tidak ditemukan: "+err.Error(), http.StatusNotFound)
			return
		}

		divProgress, err := repos.Project.GetDivisionProgress(r.Context(), uint(projID))
		if err != nil {
			http.Error(w, "gagal memuat progres divisi: "+err.Error(), http.StatusInternalServerError)
			return
		}

		outputPath, err := reportgen.GenerateProjectReport(r.Context(), agenticClient, project, divProgress, styleNotes)
		if err != nil {
			http.Error(w, "gagal membuat file presentasi project: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer os.Remove(outputPath)

		filename := fmt.Sprintf("Laporan-Project-%s.pptx", project.Name)
		w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
		http.ServeFile(w, r, outputPath)
	}
}
