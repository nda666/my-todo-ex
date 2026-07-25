package graph

import (
	"log"
	"strconv"
	"strings"
	"time"

	"golang-todo/internal/auth"
	"golang-todo/internal/libs/cloudinaryup"
	"golang-todo/internal/models"
	"golang-todo/internal/repository"

	"github.com/graphql-go/graphql"
)

func taskMutationFields(repos *repository.Repositories, t *Types) graphql.Fields {
	return graphql.Fields{
		"createTask": &graphql.Field{
			Type: t.TaskType,
			Args: graphql.FieldConfigArgument{
				"input": &graphql.ArgumentConfig{Type: graphql.NewNonNull(t.CreateTaskInput)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				input := p.Args["input"].(map[string]interface{})

				isLeader := false
				if pegawai, err := repos.Pegawai.FindByKode(p.Context, claims.ExternalToken, claims.KodeDivisi, claims.PegawaiKode); err == nil {
					isLeader = pegawai.StatusLeader == 1
				}

				targetUserKode := claims.Kodeku
				if v, ok := input["targetUserKode"]; ok && v != nil {
					targetUserKode = v.(string)
				}

				if !isLeader {
					targetUserKode = claims.Kodeku
				} else if targetUserKode != claims.Kodeku {
					targetKode, convErr := strconv.Atoi(targetUserKode)
					if convErr != nil {
						targetUserKode = claims.Kodeku
					} else if _, err := repos.Pegawai.FindByKode(p.Context, claims.ExternalToken, claims.KodeDivisi, targetKode); err != nil {
						targetUserKode = claims.Kodeku
					}
				}

				divisiKode := claims.KodeDivisi
				task := models.Task{
					Title:       input["title"].(string),
					Description: strVal(input["description"]),
					Status:      models.TaskStatusPending,
					UserKode:    targetUserKode,
					DivisiKode:  &divisiKode,
					CreatedBy:   claims.Kodeku,
				}
				if status, ok := input["status"]; ok && status != nil {
					task.Status = status.(models.TaskStatus)
				}
				if v, ok := input["startDate"]; ok && v != nil {
					task.StartDate = parseDatePtr(v)
				}
				if v, ok := input["dueDate"]; ok && v != nil {
					task.DueDate = parseDatePtr(v)
				}
				if err := repos.Task.Create(p.Context, &task); err != nil {
					return nil, err
				}

				if projVal, ok := input["projectId"]; ok && projVal != nil && projVal != "" {
					projID, parseErr := parseID(projVal)
					if parseErr == nil && projID > 0 {
						if err := repos.Project.AttachTask(p.Context, projID, task.ID); err != nil {
							log.Printf("Failed to attach task %d to project %d: %v", task.ID, projID, err)
						}
					}
				}

				if metaList, ok := input["meta"].([]interface{}); ok {
					for i, raw := range metaList {
						m := raw.(map[string]interface{})
						_type := m["type"].(models.MetaType)
						cleanVal := strVal(m["value"])
						if _type == models.MetaTypeFile || _type == models.MetaTypeImage {
							movedUrl, err := cloudinaryup.MoveAssetIdToPublicFolder(p.Context, cleanVal)
							if err == nil {
								cleanVal = movedUrl
							} else {
								cleanVal = ""
							}
						}
						meta := models.TaskMeta{
							TaskID:    task.ID,
							Key:       m["key"].(string),
							Value:     cleanVal,
							Type:      m["type"].(models.MetaType),
							SortOrder: i,
						}
						repos.Meta.Create(p.Context, &meta)
					}
				}

				if subtaskList, ok := input["subtasks"].([]interface{}); ok {
					for i, raw := range subtaskList {
						if desc, ok := raw.(string); ok && strings.TrimSpace(desc) != "" {
							st := models.Subtask{
								TaskID:      task.ID,
								Description: strings.TrimSpace(desc),
								Status:      models.SubtaskStatusPending,
								SortOrder:   i,
							}
							repos.Subtask.Create(p.Context, &st)
						}
					}
				}

				createdTask, err := repos.Task.FindByID(p.Context, task.ID)
				if err != nil {
					return nil, err
				}
				return formatTask(*createdTask, claims.Kodeku), nil
			},
		},

		"updateTask": &graphql.Field{
			Type: t.TaskType,
			Args: graphql.FieldConfigArgument{
				"id":    &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"input": &graphql.ArgumentConfig{Type: graphql.NewNonNull(t.UpdateTaskInput)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				id, err := parseID(p.Args["id"])
				if err != nil {
					return nil, err
				}
				task, err := repos.Task.FindOwned(p.Context, id, claims.Kodeku)
				if err != nil {
					return nil, err
				}
				input := p.Args["input"].(map[string]interface{})
				if v, ok := input["title"]; ok && v != nil {
					task.Title = v.(string)
				}
				if v, ok := input["description"]; ok {
					task.Description = strVal(v)
				}
				if v, ok := input["status"]; ok && v != nil {
					newStatus := v.(models.TaskStatus)
					if newStatus == models.TaskStatusCompleted && task.Status != models.TaskStatusCompleted {
						now := time.Now()
						task.CompletedAt = &now
					} else if newStatus != models.TaskStatusCompleted && task.Status == models.TaskStatusCompleted {
						task.CompletedAt = nil
					}
					task.Status = newStatus
				}
				if v, ok := input["startDate"]; ok {
					task.StartDate = parseDatePtr(v)
				}
				if v, ok := input["dueDate"]; ok {
					task.DueDate = parseDatePtr(v)
				}
				if err := repos.Task.Save(p.Context, task); err != nil {
					return nil, err
				}

				if metaList, ok := input["meta"].([]interface{}); ok {
					if err := repos.Meta.DeleteAllForTask(p.Context, task.ID); err == nil {
						for i, raw := range metaList {
							m := raw.(map[string]interface{})
							_type := m["type"].(models.MetaType)
							cleanVal := strVal(m["value"])
							if (_type == models.MetaTypeFile || _type == models.MetaTypeImage) && cleanVal != "" && !strings.HasPrefix(cleanVal, "http") {
								movedUrl, err := cloudinaryup.MoveAssetIdToPublicFolder(p.Context, cleanVal)
								if err == nil {
									cleanVal = movedUrl
								}
							}
							meta := models.TaskMeta{
								TaskID:    task.ID,
								Key:       m["key"].(string),
								Value:     cleanVal,
								Type:      _type,
								SortOrder: i,
							}
							_ = repos.Meta.Create(p.Context, &meta)
						}
					}
				}
				updated, err := repos.Task.FindByID(p.Context, task.ID)
				if err != nil {
					return nil, err
				}
				return formatTask(*updated, claims.Kodeku), nil
			},
		},

		"reorderTasks": &graphql.Field{
			Type: graphql.NewList(t.TaskType),
			Args: graphql.FieldConfigArgument{
				"orderedIds": &graphql.ArgumentConfig{Type: graphql.NewList(graphql.NewNonNull(graphql.ID))},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				idsRaw, _ := p.Args["orderedIds"].([]interface{})
				orderedIDs := make([]uint, 0, len(idsRaw))
				for _, raw := range idsRaw {
					id, err := parseID(raw)
					if err == nil {
						orderedIDs = append(orderedIDs, id)
					}
				}
				res, err := repos.Task.Reorder(p.Context, claims.Kodeku, orderedIDs)
				if err != nil {
					return nil, err
				}
				return formatTasks(res, claims.Kodeku), nil
			},
		},

		"deleteTask": &graphql.Field{
			Type: graphql.Boolean,
			Args: graphql.FieldConfigArgument{
				"id": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				id, err := parseID(p.Args["id"])
				if err != nil {
					return nil, err
				}
				deleted, err := repos.Task.Delete(p.Context, id, claims.Kodeku)
				if err != nil {
					return nil, err
				}
				return deleted, nil
			},
		},

		"setTaskMeta": &graphql.Field{
			Type: t.TaskMetaType,
			Args: graphql.FieldConfigArgument{
				"taskId": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"key":    &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
				"value":  &graphql.ArgumentConfig{Type: graphql.String},
				"type":   &graphql.ArgumentConfig{Type: t.MetaTypeEnum},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				taskID, err := parseID(p.Args["taskId"])
				if err != nil {
					return nil, err
				}
				if _, err := repos.Task.FindOwned(p.Context, taskID, claims.Kodeku); err != nil {
					return nil, err
				}

				key := p.Args["key"].(string)
				value := strVal(p.Args["value"])
				metaType := models.MetaTypeText
				if v, ok := p.Args["type"]; ok && v != nil {
					metaType = v.(models.MetaType)
				}

				if metaType == models.MetaTypeFile || metaType == models.MetaTypeImage {
					movedUrl, err := cloudinaryup.MoveAssetIdToPublicFolder(p.Context, value)
					if err == nil {
						value = movedUrl
					}
				}

				meta, err := repos.Meta.Upsert(p.Context, taskID, key, value, metaType)
				if err != nil {
					return nil, err
				}
				return formatMeta(*meta), nil
			},
		},

		"deleteTaskMeta": &graphql.Field{
			Type: graphql.Boolean,
			Args: graphql.FieldConfigArgument{
				"id": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				id, err := parseID(p.Args["id"])
				if err != nil {
					return nil, err
				}
				deleted, err := repos.Meta.Delete(p.Context, id, claims.Kodeku)
				if err != nil {
					return nil, err
				}
				return deleted, nil
			},
		},

		"reorderTaskMeta": &graphql.Field{
			Type: graphql.Boolean,
			Args: graphql.FieldConfigArgument{
				"taskId":     &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"orderedIds": &graphql.ArgumentConfig{Type: graphql.NewList(graphql.NewNonNull(graphql.ID))},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				taskID, err := parseID(p.Args["taskId"])
				if err != nil {
					return nil, err
				}
				if _, err := repos.Task.FindOwned(p.Context, taskID, claims.Kodeku); err != nil {
					return false, err
				}

				idsRaw, _ := p.Args["orderedIds"].([]interface{})
				orderedIDs := make([]uint, 0, len(idsRaw))
				for _, raw := range idsRaw {
					id, err := parseID(raw)
					if err == nil {
						orderedIDs = append(orderedIDs, id)
					}
				}
				if err := repos.Meta.Reorder(p.Context, taskID, orderedIDs); err != nil {
					return false, err
				}
				return true, nil
			},
		},
	}
}
