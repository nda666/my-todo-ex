package graph

import (
	"testing"

	"golang-todo/internal/auth"
	"golang-todo/internal/repository"
)

func TestNewSchema(t *testing.T) {
	repos := &repository.Repositories{}
	authSvc := &auth.Service{}
	policy := &auth.ProjectPolicy{}

	schema, err := NewSchema(repos, authSvc, nil, policy)
	if err != nil {
		t.Fatalf("failed to create schema: %v", err)
	}

	if schema == nil {
		t.Fatal("expected schema to be non-nil")
	}

	queryType := schema.Schema.QueryType()
	if queryType == nil {
		t.Fatal("expected QueryType to be non-nil")
	}

	fields := queryType.Fields()
	expectedQueries := []string{"me", "tasks", "projects", "divisions", "colleagues", "teamsSummary"}
	for _, q := range expectedQueries {
		if _, ok := fields[q]; !ok {
			t.Errorf("expected query field %s in schema", q)
		}
	}

	mutationType := schema.Schema.MutationType()
	if mutationType == nil {
		t.Fatal("expected MutationType to be non-nil")
	}

	mFields := mutationType.Fields()
	expectedMutations := []string{"login", "createTask", "updateTask", "deleteTask", "createProject", "askDora"}
	for _, m := range expectedMutations {
		if _, ok := mFields[m]; !ok {
			t.Errorf("expected mutation field %s in schema", m)
		}
	}
}
