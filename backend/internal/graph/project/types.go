package project

import (
	"golang-todo/internal/models"

	"github.com/graphql-go/graphql"
)

type Types struct {
	ProjectStageEnum                 *graphql.Enum
	ProjectStageHistoryType          *graphql.Object
	DivisionProgressType             *graphql.Object
	WorkflowStepStatusEnum           *graphql.Enum
	ProjectWorkflowStepType          *graphql.Object
	CreateProjectWorkflowStepInputType *graphql.InputObject
	UpdateProjectWorkflowStepInputType *graphql.InputObject
	ProjectType                      *graphql.Object
}

func BuildTypes() *Types {
	projectStageEnum := graphql.NewEnum(graphql.EnumConfig{
		Name: "ProjectStage",
		Values: graphql.EnumValueConfigMap{
			"PLANNING":    &graphql.EnumValueConfig{Value: models.ProjectStagePlanning},
			"IN_PROGRESS": &graphql.EnumValueConfig{Value: models.ProjectStageInProgress},
			"REVIEW":      &graphql.EnumValueConfig{Value: models.ProjectStageReview},
			"REJECTED":    &graphql.EnumValueConfig{Value: models.ProjectStageRejected},
			"ON_HOLD":     &graphql.EnumValueConfig{Value: models.ProjectStageOnHold},
			"CANCELLED":   &graphql.EnumValueConfig{Value: models.ProjectStageCancelled},
			"DONE":        &graphql.EnumValueConfig{Value: models.ProjectStageDone},
		},
	})

	workflowStepStatusEnum := graphql.NewEnum(graphql.EnumConfig{
		Name: "WorkflowStepStatus",
		Values: graphql.EnumValueConfigMap{
			"PENDING":     &graphql.EnumValueConfig{Value: models.WorkflowStepStatusPending},
			"IN_PROGRESS": &graphql.EnumValueConfig{Value: models.WorkflowStepStatusInProgress},
			"COMPLETED":   &graphql.EnumValueConfig{Value: models.WorkflowStepStatusCompleted},
		},
	})

	projectStageHistoryType := graphql.NewObject(graphql.ObjectConfig{
		Name: "ProjectStageHistory",
		Fields: graphql.Fields{
			"id":        &graphql.Field{Type: graphql.NewNonNull(graphql.ID)},
			"fromStage": &graphql.Field{Type: graphql.NewNonNull(projectStageEnum)},
			"toStage":   &graphql.Field{Type: graphql.NewNonNull(projectStageEnum)},
			"changedBy": &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"changedAt": &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"note":      &graphql.Field{Type: graphql.String},
		},
	})

	divisionProgressType := graphql.NewObject(graphql.ObjectConfig{
		Name: "DivisionProgress",
		Fields: graphql.Fields{
			"divisiKode":     &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"divisiNama":     &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"totalTasks":     &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"completedTasks": &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"percentDone":    &graphql.Field{Type: graphql.NewNonNull(graphql.Float)},
		},
	})

	var projectWorkflowStepType *graphql.Object
	projectWorkflowStepType = graphql.NewObject(graphql.ObjectConfig{
		Name: "ProjectWorkflowStep",
		Fields: graphql.FieldsThunk(func() graphql.Fields {
			return graphql.Fields{
				"id":          &graphql.Field{Type: graphql.NewNonNull(graphql.ID)},
				"projectId":   &graphql.Field{Type: graphql.NewNonNull(graphql.ID)},
				"parentId":    &graphql.Field{Type: graphql.ID},
				"title":       &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
				"description": &graphql.Field{Type: graphql.String},
				"divisiKode":  &graphql.Field{Type: graphql.Int},
				"status":      &graphql.Field{Type: graphql.NewNonNull(workflowStepStatusEnum)},
				"sortOrder":   &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
				"createdBy":   &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
				"createdAt":   &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
				"updatedAt":   &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
				"children":    &graphql.Field{Type: graphql.NewNonNull(graphql.NewList(graphql.NewNonNull(projectWorkflowStepType)))},
			}
		}),
	})

	createProjectWorkflowStepInputType := graphql.NewInputObject(graphql.InputObjectConfig{
		Name: "CreateProjectWorkflowStepInput",
		Fields: graphql.InputObjectConfigFieldMap{
			"projectId":   &graphql.InputObjectFieldConfig{Type: graphql.NewNonNull(graphql.ID)},
			"parentId":    &graphql.InputObjectFieldConfig{Type: graphql.ID},
			"title":       &graphql.InputObjectFieldConfig{Type: graphql.NewNonNull(graphql.String)},
			"description": &graphql.InputObjectFieldConfig{Type: graphql.String},
			"divisiKode":  &graphql.InputObjectFieldConfig{Type: graphql.Int},
			"status":      &graphql.InputObjectFieldConfig{Type: workflowStepStatusEnum},
		},
	})

	updateProjectWorkflowStepInputType := graphql.NewInputObject(graphql.InputObjectConfig{
		Name: "UpdateProjectWorkflowStepInput",
		Fields: graphql.InputObjectConfigFieldMap{
			"title":       &graphql.InputObjectFieldConfig{Type: graphql.String},
			"description": &graphql.InputObjectFieldConfig{Type: graphql.String},
			"divisiKode":  &graphql.InputObjectFieldConfig{Type: graphql.Int},
			"status":      &graphql.InputObjectFieldConfig{Type: workflowStepStatusEnum},
		},
	})

	projectType := graphql.NewObject(graphql.ObjectConfig{
		Name: "Project",
		Fields: graphql.Fields{
			"id":               &graphql.Field{Type: graphql.NewNonNull(graphql.ID)},
			"name":             &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"description":      &graphql.Field{Type: graphql.String},
			"ownerDivisiKode":  &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"status":           &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"stage":            &graphql.Field{Type: graphql.NewNonNull(projectStageEnum)},
			"stageVersion":     &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"createdAt":        &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"divisions":        &graphql.Field{Type: graphql.NewList(graphql.NewNonNull(graphql.Int))},
			"leaders":          &graphql.Field{Type: graphql.NewList(graphql.NewNonNull(graphql.String))},
			"stageHistory":     &graphql.Field{Type: graphql.NewList(graphql.NewNonNull(projectStageHistoryType))},
			"divisionProgress": &graphql.Field{Type: graphql.NewList(graphql.NewNonNull(divisionProgressType))},
			"workflowSteps":    &graphql.Field{Type: graphql.NewNonNull(graphql.NewList(graphql.NewNonNull(projectWorkflowStepType)))},
		},
	})

	return &Types{
		ProjectStageEnum:                 projectStageEnum,
		ProjectStageHistoryType:          projectStageHistoryType,
		DivisionProgressType:             divisionProgressType,
		WorkflowStepStatusEnum:           workflowStepStatusEnum,
		ProjectWorkflowStepType:          projectWorkflowStepType,
		CreateProjectWorkflowStepInputType: createProjectWorkflowStepInputType,
		UpdateProjectWorkflowStepInputType: updateProjectWorkflowStepInputType,
		ProjectType:                      projectType,
	}
}
