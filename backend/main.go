// backend/main.go
package main

import (
	"context"
	"log"
	"net/http"
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
	http.Handle("/query", authMiddleware(authService, h))

	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://127.0.0.1:5173"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
	})

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
