package graph

import (
	"golang-todo/internal/models"

	"github.com/graphql-go/graphql"
)

type projectTypes struct {
	ProjectStageEnum        *graphql.Enum
	ProjectStageHistoryType *graphql.Object
	DivisionProgressType    *graphql.Object
	ProjectType             *graphql.Object
}

func buildProjectTypes() projectTypes {
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
		},
	})

	return projectTypes{
		ProjectStageEnum:        projectStageEnum,
		ProjectStageHistoryType: projectStageHistoryType,
		DivisionProgressType:    divisionProgressType,
		ProjectType:             projectType,
	}
}
