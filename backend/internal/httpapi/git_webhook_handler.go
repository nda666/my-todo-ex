package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"golang-todo/internal/auth"
	"golang-todo/internal/graph/helpers"
	"golang-todo/internal/libs/pubsub"
	"golang-todo/internal/models"
	"golang-todo/internal/repository"
)

type GitCommitPayload struct {
	CommitMessage string `json:"commit_message"`
	Branch        string `json:"branch"`
	CommitHash    string `json:"commit_hash"`
	Repo          string `json:"repo"`
	Status        string `json:"status"`
	AuthorName    string `json:"author_name"`
	AuthorEmail   string `json:"author_email"`
	URL           string `json:"url"`

	// GitHub / GitLab payload fields
	Ref        string `json:"ref"`
	Repository struct {
		Name string `json:"name"`
	} `json:"repository"`
	Project struct {
		Name string `json:"name"`
	} `json:"project"`
	Commits []struct {
		ID      string `json:"id"`
		Message string `json:"message"`
		URL     string `json:"url"`
		Author  struct {
			Name  string `json:"name"`
			Email string `json:"email"`
		} `json:"author"`
	} `json:"commits"`
}

func GitWebhookHandler(repos *repository.Repositories, authService *auth.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		ctx := r.Context()
		claims, err := auth.RequireUser(ctx)
		if err != nil {
			// Cek token dari header Authorization, X-Git-Token, atau query param 'token'
			rawToken := ""
			authHeader := r.Header.Get("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				rawToken = strings.TrimPrefix(authHeader, "Bearer ")
			} else if gitToken := r.Header.Get("X-Git-Token"); gitToken != "" {
				rawToken = gitToken
			} else if qToken := r.URL.Query().Get("token"); qToken != "" {
				rawToken = qToken
			}

			if rawToken == "" {
				http.Error(w, "unauthorized: token tidak ditemukan", http.StatusUnauthorized)
				return
			}

			var wt models.WebhookToken
			if errTok := repos.DB.WithContext(ctx).Where("token = ?", rawToken).First(&wt).Error; errTok == nil {
				claims = &auth.Claims{
					Kodeku:     wt.UserKode,
					KodeDivisi: wt.DivisiKode,
				}
				now := time.Now()
				_ = repos.DB.WithContext(ctx).Model(&wt).Update("last_used_at", now).Error
			} else {
				parsedClaims, parseErr := authService.ParseToken(rawToken)
				if parseErr != nil {
					http.Error(w, "unauthorized: token webhook tidak valid", http.StatusUnauthorized)
					return
				}
				claims = parsedClaims
			}
		}

		bodyBytes, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "gagal membaca body", http.StatusBadRequest)
			return
		}
		defer r.Body.Close()

		var payload GitCommitPayload
		if err := json.Unmarshal(bodyBytes, &payload); err != nil {
			http.Error(w, "invalid json payload", http.StatusBadRequest)
			return
		}

		// Normalisasi input jika berasal dari GitHub/GitLab webhook
		type normalizedCommit struct {
			message string
			branch  string
			hash    string
			repo    string
			url     string
		}

		var commitsToProcess []normalizedCommit

		if len(payload.Commits) > 0 {
			repoName := payload.Repository.Name
			if repoName == "" {
				repoName = payload.Project.Name
			}
			branch := payload.Ref
			if strings.HasPrefix(branch, "refs/heads/") {
				branch = strings.TrimPrefix(branch, "refs/heads/")
			}

			for _, c := range payload.Commits {
				commitsToProcess = append(commitsToProcess, normalizedCommit{
					message: strings.TrimSpace(c.Message),
					branch:  branch,
					hash:    c.ID,
					repo:    repoName,
					url:     c.URL,
				})
			}
		} else {
			// Direct local git hook payload
			commitsToProcess = append(commitsToProcess, normalizedCommit{
				message: strings.TrimSpace(payload.CommitMessage),
				branch:  payload.Branch,
				hash:    payload.CommitHash,
				repo:    payload.Repo,
				url:     payload.URL,
			})
		}

		if len(commitsToProcess) == 0 || (len(commitsToProcess) == 1 && commitsToProcess[0].message == "") {
			http.Error(w, "pesan commit tidak boleh kosong", http.StatusBadRequest)
			return
		}

		createdTasks := make([]map[string]interface{}, 0, len(commitsToProcess))
		now := time.Now()

		for _, item := range commitsToProcess {
			lines := strings.Split(item.message, "\n")
			title := strings.TrimSpace(lines[0])
			if title == "" {
				if item.hash != "" {
					shortHash := item.hash
					if len(shortHash) > 7 {
						shortHash = shortHash[:7]
					}
					title = "Git commit " + shortHash
				} else {
					title = "Git commit task"
				}
			}
			if len(title) > 250 {
				title = title[:247] + "..."
			}

			// Task dari webhook otomatis berstatus COMPLETED
			status := models.TaskStatusCompleted
			completedAt := &now

			// Buat deskripsi yang informatif
			var descParts []string
			if item.repo != "" {
				descParts = append(descParts, "Repository: "+item.repo)
			}
			if item.branch != "" {
				descParts = append(descParts, "Branch: "+item.branch)
			}
			if item.hash != "" {
				descParts = append(descParts, "Commit Hash: "+item.hash)
			}
			if item.message != "" {
				descParts = append(descParts, "\nPesan Commit:\n"+item.message)
			}
			desc := strings.Join(descParts, "\n")

			divisiKode := claims.KodeDivisi
			tsk := models.Task{
				Title:       title,
				Description: desc,
				Status:      status,
				Priority:    models.TaskPriorityMedium,
				UserKode:    claims.Kodeku,
				DivisiKode:  &divisiKode,
				CreatedBy:   claims.Kodeku,
				StartDate:   &now,
				CompletedAt: completedAt,
			}

			if err := repos.Task.Create(ctx, &tsk); err != nil {
				http.Error(w, "gagal menyimpan task: "+err.Error(), http.StatusInternalServerError)
				return
			}

			// Tambahkan task meta untuk tracking commit
			metaVal := ""
			if item.repo != "" {
				metaVal += item.repo
			}
			if item.branch != "" {
				metaVal += "@" + item.branch
			}
			if item.hash != "" {
				shortHash := item.hash
				if len(shortHash) > 7 {
					shortHash = shortHash[:7]
				}
				metaVal += "#" + shortHash
			}
			if metaVal != "" {
				_, _ = repos.Meta.Upsert(ctx, tsk.ID, "git_commit", metaVal, models.MetaTypeText)
			}
			if item.url != "" {
				_, _ = repos.Meta.Upsert(ctx, tsk.ID, "git_url", item.url, models.MetaTypeLink)
			}

			createdTasks = append(createdTasks, map[string]interface{}{
				"id":     tsk.ID,
				"title":  tsk.Title,
				"status": tsk.Status,
			})

			if fullTask, err := repos.Task.FindByID(ctx, tsk.ID); err == nil && fullTask != nil {
				pubsub.DefaultBroker.Publish(&pubsub.TaskEvent{
					Action:     pubsub.TaskCreated,
					Task:       helpers.FormatTask(*fullTask, claims.Kodeku),
					TaskID:     strconv.FormatUint(uint64(fullTask.ID), 10),
					DivisiKode: divisiKode,
					UserKode:   claims.Kodeku,
				})
			}
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"count":   len(createdTasks),
			"tasks":   createdTasks,
		})
	}
}
