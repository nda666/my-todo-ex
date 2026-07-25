// backend/internal/graph/schema.go — inisialisasi SessionStore, dilewatkan sebagai package-level var yang dipakai mutation.go
package graph

import (
	"fmt"
	"time"

	"golang-todo/internal/auth"
	"golang-todo/internal/libs/ai"
	"golang-todo/internal/repository"

	"github.com/graphql-go/graphql"
)

// doraSessions menyimpan riwayat chat Dora per sessionId (TTL 60 menit, maks 8 turn
// terakhir yang dikirim ke model) - inti dari solusi hemat token di percakapan ini.
var doraSessions = ai.NewSessionStore(60*time.Minute, 8)

type Schema struct {
	Schema graphql.Schema
}

func NewSchema(repos *repository.Repositories, authService *auth.Service, aiClient ai.Client, projectPolicy *auth.ProjectPolicy) (*Schema, error) {
	t := buildTypes()
	rootQuery := graphql.NewObject(graphql.ObjectConfig{Name: "Query", Fields: queryFields(repos, t)})
	rootMutation := graphql.NewObject(graphql.ObjectConfig{Name: "Mutation", Fields: mutationFields(repos, authService, aiClient, *projectPolicy, t)})
	schema, err := graphql.NewSchema(graphql.SchemaConfig{Query: rootQuery, Mutation: rootMutation})
	if err != nil {
		return nil, fmt.Errorf("create schema: %w", err)
	}
	return &Schema{Schema: schema}, nil
}
