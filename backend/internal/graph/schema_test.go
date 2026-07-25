package graph

import (
	"testing"

	"github.com/graphql-go/graphql"
)

func TestBuildTypes(t *testing.T) {
	types := buildTypes()
	if types == nil {
		t.Fatal("expected buildTypes() to return non-nil Types")
	}

	if types.UserType == nil {
		t.Error("expected UserType to be non-nil")
	}
	if types.TaskType == nil {
		t.Error("expected TaskType to be non-nil")
	}
	if types.ProjectType == nil {
		t.Error("expected ProjectType to be non-nil")
	}
	if types.DoraResponseType == nil {
		t.Error("expected DoraResponseType to be non-nil")
	}
	if types.AuthPayloadType == nil {
		t.Error("expected AuthPayloadType to be non-nil")
	}
}

func TestQueryFieldsAggregation(t *testing.T) {
	types := buildTypes()
	fields := queryFields(nil, types)

	expectedQueries := []string{"me", "tasks", "colleagues", "projects", "project", "projectDivisionProgress", "projectTasks", "colleaguesByDivisi", "divisions", "teamsSummary"}

	for _, fieldName := range expectedQueries {
		if _, exists := fields[fieldName]; !exists {
			t.Errorf("expected query field %q to exist", fieldName)
		}
	}
}

func TestMutationFieldsAggregation(t *testing.T) {
	types := buildTypes()
	fields := mutationFields(nil, nil, nil, nil, types)

	expectedMutations := []string{
		"login",
		"createTask",
		"updateTask",
		"reorderTasks",
		"deleteTask",
		"addTaskComment",
		"toggleReaction",
		"setTaskMeta",
		"deleteTaskMeta",
		"reorderTaskMeta",
		"askDora",
		"createProject",
		"inviteDivisionToProject",
		"createProjectTask",
		"reassignProjectTask",
		"removeDivisionFromProject",
		"addProjectLeader",
		"removeProjectLeader",
		"createSubtask",
		"updateSubtask",
		"deleteSubtask",
		"reorderSubtasks",
		"advanceProjectStage",
		"reopenProject",
	}

	for _, fieldName := range expectedMutations {
		if _, exists := fields[fieldName]; !exists {
			t.Errorf("expected mutation field %q to exist", fieldName)
		}
	}
}

func TestGraphQLSchemaCreation(t *testing.T) {
	types := buildTypes()
	qFields := queryFields(nil, types)
	mFields := mutationFields(nil, nil, nil, nil, types)

	rootQuery := graphql.NewObject(graphql.ObjectConfig{
		Name:   "Query",
		Fields: qFields,
	})
	rootMutation := graphql.NewObject(graphql.ObjectConfig{
		Name:   "Mutation",
		Fields: mFields,
	})

	schema, err := graphql.NewSchema(graphql.SchemaConfig{
		Query:    rootQuery,
		Mutation: rootMutation,
	})

	if err != nil {
		t.Fatalf("failed to create GraphQL schema: %v", err)
	}

	if schema.QueryType() == nil {
		t.Error("schema query type should not be nil")
	}

	if schema.MutationType() == nil {
		t.Error("schema mutation type should not be nil")
	}
}
