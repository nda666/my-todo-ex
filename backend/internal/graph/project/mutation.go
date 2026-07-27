package project

import (
	"fmt"

	"golang-todo/internal/auth"
	"golang-todo/internal/graph/helpers"
	"golang-todo/internal/models"
	"golang-todo/internal/repository"

	"github.com/graphql-go/graphql"
)

func MutationFields(repos *repository.Repositories, projectPolicy *auth.ProjectPolicy, t *Types) graphql.Fields {
	return graphql.Fields{
		"createProject": &graphql.Field{
			Type: t.ProjectType,
			Args: graphql.FieldConfigArgument{
				"name":        &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
				"description": &graphql.ArgumentConfig{Type: graphql.String},
				"divisions":   &graphql.ArgumentConfig{Type: graphql.NewList(graphql.NewNonNull(graphql.Int))},
				"leaders":     &graphql.ArgumentConfig{Type: graphql.NewList(graphql.NewNonNull(graphql.String))},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				actor, err := helpers.BuildActorContext(p.Context, repos, claims)
				if err != nil {
					return nil, err
				}
				if !projectPolicy.CanCreateProject(actor) {
					return nil, fmt.Errorf("only division leader can create project")
				}

				name := p.Args["name"].(string)
				desc := helpers.StrVal(p.Args["description"])

				var divisions []int
				if divRaw, ok := p.Args["divisions"].([]interface{}); ok {
					divisions = make([]int, 0, len(divRaw))
					for _, item := range divRaw {
						if d, ok := item.(int); ok {
							divisions = append(divisions, d)
						}
					}
				}

				var leaders []string
				if leaderRaw, ok := p.Args["leaders"].([]interface{}); ok {
					leaders = make([]string, 0, len(leaderRaw))
					for _, item := range leaderRaw {
						if l, ok := item.(string); ok {
							leaders = append(leaders, l)
						}
					}
				}

				var projDivisions []models.ProjectDivision
				for _, d := range divisions {
					projDivisions = append(projDivisions, models.ProjectDivision{
						DivisiKode: d,
						InvitedBy:  claims.Kodeku,
					})
				}

				var projLeaders []models.ProjectLeader
				for _, l := range leaders {
					projLeaders = append(projLeaders, models.ProjectLeader{
						PegawaiKode: l,
						AddedBy:     claims.Kodeku,
					})
				}

				prj := &models.Project{
					Name:            name,
					Description:     desc,
					OwnerDivisiKode: claims.KodeDivisi,
					Status:          models.ProjectStatusActive,
					Stage:           models.ProjectStagePlanning,
					StageVersion:    1,
					CreatedBy:       claims.Kodeku,
					Divisions:       projDivisions,
					Leaders:         projLeaders,
				}

				if err := repos.Project.Create(p.Context, prj); err != nil {
					return nil, err
				}

				fetchedPrj, err := repos.Project.FindByID(p.Context, prj.ID)
				if err == nil {
					prj = fetchedPrj
				}

				divProgress, _ := repos.Project.GetDivisionProgress(p.Context, prj.ID)
				return helpers.FormatProjectWithDetails(*prj, divProgress), nil
			},
		},

		"updateProjectStage": &graphql.Field{
			Type: t.ProjectType,
			Args: graphql.FieldConfigArgument{
				"id":           &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"stage":        &graphql.ArgumentConfig{Type: graphql.NewNonNull(t.ProjectStageEnum)},
				"note":         &graphql.ArgumentConfig{Type: graphql.String},
				"stageVersion": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.Int)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				id, err := helpers.ParseID(p.Args["id"])
				if err != nil {
					return nil, err
				}

				prj, err := repos.Project.FindByID(p.Context, id)
				if err != nil {
					return nil, err
				}

				actor, err := helpers.BuildActorContext(p.Context, repos, claims)
				if err != nil {
					return nil, err
				}

				newStage := p.Args["stage"].(models.ProjectStage)
				if err := projectPolicy.CanTransitionStage(actor, *prj, newStage); err != nil {
					return nil, err
				}

				note := helpers.StrVal(p.Args["note"])
				stageVersion := p.Args["stageVersion"].(int)

				updatedProject, err := repos.Project.UpdateStage(p.Context, id, newStage, claims.Kodeku, note, stageVersion)
				if err != nil {
					return nil, err
				}

				divProgress, _ := repos.Project.GetDivisionProgress(p.Context, updatedProject.ID)
				return helpers.FormatProjectWithDetails(*updatedProject, divProgress), nil
			},
		},

		"attachTaskToProject": &graphql.Field{
			Type: graphql.Boolean,
			Args: graphql.FieldConfigArgument{
				"projectId": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"taskId":    &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				projID, err := helpers.ParseID(p.Args["projectId"])
				if err != nil {
					return nil, err
				}
				taskID, err := helpers.ParseID(p.Args["taskId"])
				if err != nil {
					return nil, err
				}

				if _, err := repos.Task.FindOwned(p.Context, taskID, claims.Kodeku); err != nil {
					return false, err
				}

				if err := repos.Project.AttachTask(p.Context, projID, taskID); err != nil {
					return false, err
				}
				return true, nil
			},
		},

		"detachTaskFromProject": &graphql.Field{
			Type: graphql.Boolean,
			Args: graphql.FieldConfigArgument{
				"projectId": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"taskId":    &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				projID, err := helpers.ParseID(p.Args["projectId"])
				if err != nil {
					return nil, err
				}
				taskID, err := helpers.ParseID(p.Args["taskId"])
				if err != nil {
					return nil, err
				}

				if _, err := repos.Task.FindOwned(p.Context, taskID, claims.Kodeku); err != nil {
					return false, err
				}

				if err := repos.Project.DetachTask(p.Context, projID, taskID); err != nil {
					return false, err
				}
				return true, nil
			},
		},
	}
}
