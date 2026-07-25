package graph

import (
	"golang-todo/internal/auth"
	"golang-todo/internal/libs/ai"
	"golang-todo/internal/repository"

	"github.com/graphql-go/graphql"
)

func mutationFields(repos *repository.Repositories, authService *auth.Service, aiClient ai.Client, projectPolicy auth.ProjectPolicy, t *Types) graphql.Fields {
	fields := graphql.Fields{}

	// Auth Mutations
	for k, v := range authMutationFields(repos, authService, t) {
		fields[k] = v
	}

	// Task Mutations
	for k, v := range taskMutationFields(repos, t) {
		fields[k] = v
	}

	// Subtask Mutations
	for k, v := range subtaskMutationFields(repos, t) {
		fields[k] = v
	}

	// Comment & Reaction Mutations
	for k, v := range commentMutationFields(repos, t) {
		fields[k] = v
	}

	// Project Mutations
	for k, v := range projectMutationFields(repos, projectPolicy, t) {
		fields[k] = v
	}

	// Dora AI Mutations
	for k, v := range doraMutationFields(repos, aiClient, t) {
		fields[k] = v
	}

	return fields
}
