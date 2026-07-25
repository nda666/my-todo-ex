package graph

import (
	"errors"
	"fmt"
	"log"

	"golang-todo/internal/auth"
	"golang-todo/internal/models"
	"golang-todo/internal/repository"

	"github.com/graphql-go/graphql"
)

func projectMutationFields(repos *repository.Repositories, projectPolicy auth.ProjectPolicy, t *Types) graphql.Fields {
	return graphql.Fields{
		"createProject": &graphql.Field{
			Type: t.ProjectType,
			Args: graphql.FieldConfigArgument{
				"name":        &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
				"description": &graphql.ArgumentConfig{Type: graphql.String},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}

				actor, err := buildActorContext(p.Context, repos, claims)
				if err != nil {
					return nil, err
				}

				if !projectPolicy.CanCreateProject(actor) {
					return nil, errors.New("hanya leader divisi yang bisa membuat project")
				}

				project := models.Project{
					Name:            p.Args["name"].(string),
					Description:     strVal(p.Args["description"]),
					OwnerDivisiKode: actor.DivisiKode,
					Status:          models.ProjectStatusActive,
					CreatedBy:       claims.Kodeku,
				}
				log.Printf("Project yang akan dibuat: %+v", project)
				if err := repos.Project.Create(p.Context, &project); err != nil {
					return nil, err
				}

				if err := repos.Project.AddLeader(p.Context, project.ID, claims.Kodeku, claims.Kodeku); err != nil {
					return nil, err
				}
				repos.Project.AddDivision(p.Context, project.ID, actor.DivisiKode, claims.Kodeku)

				return formatProject(project), nil
			},
		},

		"inviteDivisionToProject": &graphql.Field{
			Type: graphql.Boolean,
			Args: graphql.FieldConfigArgument{
				"projectId":  &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"divisiKode": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.Int)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				actor, err := buildActorContext(p.Context, repos, claims)
				if err != nil {
					return nil, err
				}

				projectID, _ := parseID(p.Args["projectId"])
				allowed, err := projectPolicy.CanInviteDivision(p.Context, actor, projectID)
				if err != nil {
					return nil, err
				}
				if !allowed {
					return nil, errors.New("kamu tidak punya izin mengundang divisi ke project ini")
				}

				divisiKode := p.Args["divisiKode"].(int)
				if err := repos.Project.AddDivision(p.Context, projectID, divisiKode, claims.Kodeku); err != nil {
					return nil, err
				}
				return true, nil
			},
		},

		"createProjectTask": &graphql.Field{
			Type: t.TaskType,
			Args: graphql.FieldConfigArgument{
				"projectId":      &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"title":          &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
				"description":    &graphql.ArgumentConfig{Type: graphql.String},
				"targetUserKode": &graphql.ArgumentConfig{Type: graphql.String},
				"startDate":      &graphql.ArgumentConfig{Type: graphql.String},
				"dueDate":        &graphql.ArgumentConfig{Type: graphql.String},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				actor, err := buildActorContext(p.Context, repos, claims)
				if err != nil {
					return nil, err
				}

				projectID, _ := parseID(p.Args["projectId"])
				canCreate, err := projectPolicy.CanCreateTaskInProject(p.Context, actor, projectID)
				if err != nil {
					return nil, err
				}
				if !canCreate {
					return nil, errors.New("divisimu tidak tergabung dalam project ini")
				}

				targetUserKode := claims.Kodeku
				if v, ok := p.Args["targetUserKode"].(string); ok && v != "" && v != claims.Kodeku {
					targetPegawai, err := repos.Pegawai.FindByKode(p.Context, claims.ExternalToken, actor.DivisiKode, mustAtoi(v))
					if err != nil {
						return nil, errors.New("pegawai tujuan tidak ditemukan")
					}
					allowed, err := projectPolicy.CanAssignTaskTo(p.Context, actor, projectID, targetPegawai.KodeDivisi)
					if err != nil || !allowed {
						return nil, errors.New("kamu tidak berhak menugaskan task ke pegawai ini dalam project ini")
					}
					targetUserKode = v
				}

				divisiKode := actor.DivisiKode
				task := models.Task{
					Title:       p.Args["title"].(string),
					Description: strVal(p.Args["description"]),
					Status:      models.TaskStatusPending,
					UserKode:    targetUserKode,
					DivisiKode:  &divisiKode,
					CreatedBy:   claims.Kodeku,
					StartDate:   parseDatePtr(p.Args["startDate"]),
					DueDate:     parseDatePtr(p.Args["dueDate"]),
				}
				if err := repos.Task.Create(p.Context, &task); err != nil {
					return nil, err
				}
				if err := repos.Project.AttachTask(p.Context, projectID, task.ID); err != nil {
					return nil, err
				}

				return formatTask(task, claims.Kodeku), nil
			},
		},

		"reassignProjectTask": &graphql.Field{
			Type: t.TaskType,
			Args: graphql.FieldConfigArgument{
				"taskId":         &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"targetUserKode": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				actor, err := buildActorContext(p.Context, repos, claims)
				if err != nil {
					return nil, err
				}

				taskID, _ := parseID(p.Args["taskId"])
				projectID, err := repos.Project.ProjectIDForTask(p.Context, taskID)
				if err != nil {
					return nil, err
				}
				if projectID == nil {
					return nil, errors.New("task ini tidak terhubung ke project manapun")
				}

				targetKode := p.Args["targetUserKode"].(string)
				targetPegawai, err := repos.Pegawai.FindByKode(p.Context, claims.ExternalToken, actor.DivisiKode, mustAtoi(targetKode))
				if err != nil {
					return nil, errors.New("pegawai tujuan tidak ditemukan")
				}

				allowed, err := projectPolicy.CanAssignTaskTo(p.Context, actor, *projectID, targetPegawai.KodeDivisi)
				if err != nil || !allowed {
					return nil, errors.New("kamu tidak berhak memindahkan task ini")
				}

				task, err := repos.Task.FindByID(p.Context, taskID)
				if err != nil {
					return nil, err
				}
				task.UserKode = targetKode
				if err := repos.Task.Save(p.Context, task); err != nil {
					return nil, err
				}

				return formatTask(*task, claims.Kodeku), nil
			},
		},

		"removeDivisionFromProject": &graphql.Field{
			Type: graphql.Boolean,
			Args: graphql.FieldConfigArgument{
				"projectId":  &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"divisiKode": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.Int)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				actor, _ := buildActorContext(p.Context, repos, claims)
				projectID, _ := parseID(p.Args["projectId"])

				allowed, err := projectPolicy.CanRemoveDivision(p.Context, actor, projectID)
				if err != nil {
					return nil, err
				}
				if !allowed {
					return nil, errors.New("kamu tidak punya izin mengeluarkan divisi dari project ini")
				}
				divisiKode := p.Args["divisiKode"].(int)
				if err := repos.Project.RemoveDivision(p.Context, projectID, divisiKode); err != nil {
					return nil, err
				}
				return true, nil
			},
		},

		"addProjectLeader": &graphql.Field{
			Type: graphql.Boolean,
			Args: graphql.FieldConfigArgument{
				"projectId":   &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"pegawaiKode": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				actor, _ := buildActorContext(p.Context, repos, claims)
				projectID, _ := parseID(p.Args["projectId"])

				allowed, err := projectPolicy.CanManageProjectLeaders(p.Context, actor, projectID)
				if err != nil {
					return nil, err
				}
				if !allowed {
					return nil, errors.New("hanya project leader yang bisa menambah project leader lain")
				}
				if err := repos.Project.AddLeader(p.Context, projectID, p.Args["pegawaiKode"].(string), claims.Kodeku); err != nil {
					return nil, err
				}
				return true, nil
			},
		},

		"removeProjectLeader": &graphql.Field{
			Type: graphql.Boolean,
			Args: graphql.FieldConfigArgument{
				"projectId":   &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"pegawaiKode": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				actor, _ := buildActorContext(p.Context, repos, claims)
				projectID, _ := parseID(p.Args["projectId"])

				allowed, err := projectPolicy.CanManageProjectLeaders(p.Context, actor, projectID)
				if err != nil {
					return nil, err
				}
				if !allowed {
					return nil, errors.New("hanya project leader yang bisa menghapus project leader")
				}
				if err := repos.Project.RemoveLeader(p.Context, projectID, p.Args["pegawaiKode"].(string)); err != nil {
					return nil, err
				}
				return true, nil
			},
		},

		"advanceProjectStage": &graphql.Field{
			Type: t.ProjectType,
			Args: graphql.FieldConfigArgument{
				"projectId":       &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"toStage":         &graphql.ArgumentConfig{Type: graphql.NewNonNull(t.ProjectStageEnum)},
				"note":            &graphql.ArgumentConfig{Type: graphql.String},
				"expectedVersion": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.Int)},
				"force":           &graphql.ArgumentConfig{Type: graphql.Boolean},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				projectID, err := parseID(p.Args["projectId"])
				if err != nil {
					return nil, err
				}
				isLeader, err := repos.Project.IsProjectLeader(p.Context, projectID, claims.Kodeku)
				if err != nil || !isLeader {
					return nil, errors.New("hanya project leader yang dapat mengubah stage project")
				}

				toStage := p.Args["toStage"].(models.ProjectStage)
				if toStage == models.ProjectStageDone {
					force, _ := p.Args["force"].(bool)
					if !force {
						incompleteCount, err := repos.Project.CountIncompleteTasks(p.Context, projectID)
						if err == nil && incompleteCount > 0 {
							return nil, fmt.Errorf("masih ada %d task yang belum selesai. Gunakan konfirmasi eksplisit (force: true) untuk menyelesaikan project.", incompleteCount)
						}
					}
				}

				note := strVal(p.Args["note"])
				expectedVersion := p.Args["expectedVersion"].(int)

				updated, err := repos.Project.UpdateStage(p.Context, projectID, toStage, note, claims.Kodeku, expectedVersion)
				if err != nil {
					return nil, err
				}
				divProgress, _ := repos.Project.GetDivisionProgress(p.Context, projectID)
				return formatProjectWithDetails(*updated, divProgress), nil
			},
		},

		"reopenProject": &graphql.Field{
			Type: t.ProjectType,
			Args: graphql.FieldConfigArgument{
				"projectId":       &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"expectedVersion": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.Int)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				projectID, err := parseID(p.Args["projectId"])
				if err != nil {
					return nil, err
				}
				isLeader, err := repos.Project.IsProjectLeader(p.Context, projectID, claims.Kodeku)
				if err != nil || !isLeader {
					return nil, errors.New("hanya project leader yang dapat meng-reopen project")
				}

				expectedVersion := p.Args["expectedVersion"].(int)
				updated, err := repos.Project.ReopenProject(p.Context, projectID, expectedVersion, claims.Kodeku)
				if err != nil {
					return nil, err
				}
				divProgress, _ := repos.Project.GetDivisionProgress(p.Context, projectID)
				return formatProjectWithDetails(*updated, divProgress), nil
			},
		},
	}
}
