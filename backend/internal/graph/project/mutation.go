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

		"createProjectWorkflowStep": &graphql.Field{
			Type: t.ProjectWorkflowStepType,
			Args: graphql.FieldConfigArgument{
				"input": &graphql.ArgumentConfig{Type: graphql.NewNonNull(t.CreateProjectWorkflowStepInputType)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				input := p.Args["input"].(map[string]interface{})
				projectID, err := helpers.ParseID(input["projectId"])
				if err != nil {
					return nil, err
				}
				var parentID *uint
				if rawParent, ok := input["parentId"]; ok && rawParent != nil {
					if pid, err := helpers.ParseID(rawParent); err == nil && pid > 0 {
						parentID = &pid
					}
				}
				title := input["title"].(string)
				desc := helpers.StrVal(input["description"])

				var divisiKode *int
				if dk, ok := input["divisiKode"].(int); ok {
					divisiKode = &dk
				}

				status := models.WorkflowStepStatusPending
				if stRaw, ok := input["status"]; ok && stRaw != nil {
					switch st := stRaw.(type) {
					case models.WorkflowStepStatus:
						if st != "" {
							status = st
						}
					case string:
						if st != "" {
							status = models.WorkflowStepStatus(st)
						}
					}
				}

				step := &models.ProjectWorkflowStep{
					ProjectID:   projectID,
					ParentID:    parentID,
					Title:       title,
					Description: desc,
					DivisiKode:  divisiKode,
					Status:      status,
					CreatedBy:   claims.Kodeku,
				}

				if err := repos.Project.CreateWorkflowStep(p.Context, step); err != nil {
					return nil, err
				}

				return helpers.FormatProjectWorkflowStep(*step), nil
			},
		},

		"updateProjectWorkflowStep": &graphql.Field{
			Type: t.ProjectWorkflowStepType,
			Args: graphql.FieldConfigArgument{
				"id":    &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"input": &graphql.ArgumentConfig{Type: graphql.NewNonNull(t.UpdateProjectWorkflowStepInputType)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				if _, err := auth.RequireUser(p.Context); err != nil {
					return nil, err
				}
				stepID, err := helpers.ParseID(p.Args["id"])
				if err != nil {
					return nil, err
				}
				input := p.Args["input"].(map[string]interface{})
				updates := make(map[string]interface{})
				if title, ok := input["title"].(string); ok && title != "" {
					updates["title"] = title
				}
				if desc, ok := input["description"].(string); ok {
					updates["description"] = desc
				}
				if dk, ok := input["divisiKode"].(int); ok {
					updates["divisi_kode"] = dk
				}
				if stRaw, ok := input["status"]; ok && stRaw != nil {
					switch st := stRaw.(type) {
					case models.WorkflowStepStatus:
						if st != "" {
							updates["status"] = st
						}
					case string:
						if st != "" {
							updates["status"] = models.WorkflowStepStatus(st)
						}
					}
				}

				updated, err := repos.Project.UpdateWorkflowStep(p.Context, stepID, updates)
				if err != nil {
					return nil, err
				}
				return helpers.FormatProjectWorkflowStep(*updated), nil
			},
		},

		"deleteProjectWorkflowStep": &graphql.Field{
			Type: graphql.Boolean,
			Args: graphql.FieldConfigArgument{
				"id": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				if _, err := auth.RequireUser(p.Context); err != nil {
					return false, err
				}
				stepID, err := helpers.ParseID(p.Args["id"])
				if err != nil {
					return false, err
				}
				if err := repos.Project.DeleteWorkflowStep(p.Context, stepID); err != nil {
					return false, err
				}
				return true, nil
			},
		},

		"reorderProjectWorkflowSteps": &graphql.Field{
			Type: graphql.Boolean,
			Args: graphql.FieldConfigArgument{
				"projectId":  &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"parentId":   &graphql.ArgumentConfig{Type: graphql.ID},
				"orderedIds": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.NewList(graphql.NewNonNull(graphql.ID)))},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				if _, err := auth.RequireUser(p.Context); err != nil {
					return false, err
				}
				projectID, err := helpers.ParseID(p.Args["projectId"])
				if err != nil {
					return false, err
				}
				var parentID *uint
				if rawParent, ok := p.Args["parentId"]; ok && rawParent != nil {
					if pid, err := helpers.ParseID(rawParent); err == nil && pid > 0 {
						parentID = &pid
					}
				}
				var orderedIDs []uint
				if list, ok := p.Args["orderedIds"].([]interface{}); ok {
					for _, item := range list {
						if id, err := helpers.ParseID(item); err == nil {
							orderedIDs = append(orderedIDs, id)
						}
					}
				}
				if err := repos.Project.ReorderWorkflowSteps(p.Context, projectID, parentID, orderedIDs); err != nil {
					return false, err
				}
				return true, nil
			},
		},
	}
}
