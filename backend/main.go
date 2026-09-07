// backend/main.go
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"golang-todo/internal/auth"
	"golang-todo/internal/config"
	"golang-todo/internal/database"
	"golang-todo/internal/graph"
	"golang-todo/internal/httpapi"
	"golang-todo/internal/libs/ai"
	"golang-todo/internal/libs/cache"
	"golang-todo/internal/libs/doranapi"
	"golang-todo/internal/repository"
	"golang-todo/internal/ws"

	"github.com/graphql-go/handler"
	"github.com/rs/cors"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	db, err := database.Connect(cfg)
	if err != nil {
		log.Fatalf("database: %v", err)
	}

	doranClient := doranapi.NewClient(cfg.DoranAPIKey, cfg.DoranAuthBaseURL, cfg.DoranOfficeBaseURL)
	dataCache := cache.New(380 * time.Minute)
	repos := repository.NewRepositories(db, doranClient, dataCache)
	authService := auth.NewService(cfg, doranClient)

	aiClient := &ai.FallbackClient{
		Providers: []ai.Client{
			ai.NewGeminiClient(cfg.GeminiAPIKey, cfg.GeminiModel),
			ai.NewOpenRouterClient(cfg.OpenRouterAPIKey, cfg.OpenRouterModel),
			ai.NewNimClient(cfg.NimAPIKey, cfg.NimModel),
		},
	}
	// Client terpisah khusus tool-calling, dipakai Dora untuk membangun file .pptx
	// sendiri lewat MCP pptxgen. OpenRouter dipilih karena dukungan function-calling
	// lebih luas lintas model dibanding NIM.
	agenticClient := ai.NewAgenticGeminiClient(cfg.GeminiAPIKey, cfg.GeminiModel)

	projectPolicy := auth.NewProjectPolicy(repos.Project, repos.Pegawai)
	schema, err := graph.NewSchema(repos, authService, aiClient, projectPolicy)

	if err != nil {
		log.Fatalf("graphql schema: %v", err)
	}

	h := handler.New(&handler.Config{
		Schema:   &schema.Schema,
		Pretty:   true,
		GraphiQL: true,
	})

	http.Handle("/api/upload-avatar", authMiddleware(authService, httpapi.UploadAvatarHandler(repos)))
	http.Handle("/api/reports/team-summary", authMiddleware(authService, httpapi.GenerateReportHandler(repos, aiClient, agenticClient)))
	http.Handle("/api/reports/project-summary", authMiddleware(authService, httpapi.GenerateProjectReportHandler(repos, agenticClient)))
	http.Handle("/api/webhooks/git", authMiddleware(authService, httpapi.GitWebhookHandler(repos, authService)))
	http.Handle("/api/webhook-tokens", authMiddleware(authService, httpapi.WebhookTokenHandler(repos)))
	http.Handle("/query", authMiddleware(authService, h))
	http.Handle("/subscriptions", ws.NewHandler(&schema.Schema, authService))

	// Sajikan static frontend build jika direktori dist tersedia (Single Container All-in-One)
	distDir := "./dist"
	if fi, err := os.Stat(distDir); err == nil && fi.IsDir() {
		fs := http.FileServer(http.Dir(distDir))
		http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			path := filepath.Join(distDir, filepath.Clean(r.URL.Path))
			if info, err := os.Stat(path); err == nil && !info.IsDir() {
				fs.ServeHTTP(w, r)
				return
			}
			http.ServeFile(w, r, filepath.Join(distDir, "index.html"))
		})
	}

	corsOptions := cors.Options{
		AllowedMethods:   []string{"GET", "POST", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "X-Git-Token"},
		AllowCredentials: true,
	}

	if cfg.CorsAllowedOrigins != "" {
		origins := []string{"http://localhost:5173", "http://127.0.0.1:5173"}
		for _, o := range strings.Split(cfg.CorsAllowedOrigins, ",") {
			if trimmed := strings.TrimSpace(o); trimmed != "" {
				origins = append(origins, trimmed)
			}
		}
		corsOptions.AllowedOrigins = origins
	} else {
		corsOptions.AllowOriginFunc = func(origin string) bool {
			return true
		}
	}

	c := cors.New(corsOptions)

	port := cfg.ServerPort
	log.Printf("server running on http://localhost:%s/query", port)
	log.Fatal(http.ListenAndServe(":"+port, c.Handler(http.DefaultServeMux)))
}

func authMiddleware(authService *auth.Service, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		header := r.Header.Get("Authorization")
		if strings.HasPrefix(header, "Bearer ") {
			token := strings.TrimPrefix(header, "Bearer ")
			if claims, err := authService.ParseToken(token); err == nil {
				ctx = context.WithValue(ctx, auth.UserContextKey, claims)
			}
		}

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
