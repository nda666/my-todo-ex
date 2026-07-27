package graph

import (
	"fmt"

	"golang-todo/internal/auth"
	"golang-todo/internal/graph/dora"
	"golang-todo/internal/graph/project"
	"golang-todo/internal/graph/task"
	"golang-todo/internal/graph/user"
	"golang-todo/internal/libs/ai"
	"golang-todo/internal/repository"

	"github.com/graphql-go/graphql"
)

type Schema struct {
	Schema graphql.Schema
}

func NewSchema(repos *repository.Repositories, authService *auth.Service, aiClient ai.Client, projectPolicy *auth.ProjectPolicy) (*Schema, error) {
	userTypes := user.BuildTypes()
	taskTypes := task.BuildTypes()
	projectTypes := project.BuildTypes()
	doraTypes := dora.BuildTypes()

	queryFields := graphql.Fields{}
	for k, v := range user.QueryFields(repos, userTypes) {
		queryFields[k] = v
	}
	for k, v := range task.QueryFields(repos, taskTypes) {
		queryFields[k] = v
	}
	for k, v := range project.QueryFields(repos, projectTypes, taskTypes) {
		queryFields[k] = v
	}

	mutationFields := graphql.Fields{}
	for k, v := range user.MutationFields(repos, authService, userTypes) {
		mutationFields[k] = v
	}
	for k, v := range task.MutationFields(repos, taskTypes) {
		mutationFields[k] = v
	}
	for k, v := range project.MutationFields(repos, projectPolicy, projectTypes) {
		mutationFields[k] = v
	}
	for k, v := range dora.MutationFields(repos, aiClient, doraTypes) {
		mutationFields[k] = v
	}

	rootQuery := graphql.NewObject(graphql.ObjectConfig{
		Name:   "Query",
		Fields: queryFields,
	})
	rootMutation := graphql.NewObject(graphql.ObjectConfig{
		Name:   "Mutation",
		Fields: mutationFields,
	})

	schema, err := graphql.NewSchema(graphql.SchemaConfig{
		Query:    rootQuery,
		Mutation: rootMutation,
	})
	if err != nil {
		return nil, fmt.Errorf("create schema: %w", err)
	}

	return &Schema{Schema: schema}, nil
}
