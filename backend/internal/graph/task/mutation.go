package task

import (
	"log"
	"strconv"
	"strings"
	"time"

	"golang-todo/internal/auth"
	"golang-todo/internal/graph/helpers"
	"golang-todo/internal/libs/cloudinaryup"
	"golang-todo/internal/models"
	"golang-todo/internal/repository"

	"github.com/graphql-go/graphql"
)

func MutationFields(repos *repository.Repositories, t *Types) graphql.Fields {
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
				tsk := models.Task{
					Title:       input["title"].(string),
					Description: helpers.StrVal(input["description"]),
					Status:      models.TaskStatusPending,
					UserKode:    targetUserKode,
					DivisiKode:  &divisiKode,
					CreatedBy:   claims.Kodeku,
				}
				if status, ok := input["status"]; ok && status != nil {
					tsk.Status = status.(models.TaskStatus)
				}
				if v, ok := input["startDate"]; ok && v != nil {
					tsk.StartDate = helpers.ParseDatePtr(v)
				}
				if v, ok := input["dueDate"]; ok && v != nil {
					tsk.DueDate = helpers.ParseDatePtr(v)
				}
				if err := repos.Task.Create(p.Context, &tsk); err != nil {
					return nil, err
				}

				if projVal, ok := input["projectId"]; ok && projVal != nil && projVal != "" {
					projID, parseErr := helpers.ParseID(projVal)
					if parseErr == nil && projID > 0 {
						if err := repos.Project.AttachTask(p.Context, projID, tsk.ID); err != nil {
							log.Printf("Failed to attach task %d to project %d: %v", tsk.ID, projID, err)
						}
					}
				}

				if metaList, ok := input["meta"].([]interface{}); ok {
					for i, raw := range metaList {
						m := raw.(map[string]interface{})
						_type := m["type"].(models.MetaType)
						cleanVal := helpers.StrVal(m["value"])
						if _type == models.MetaTypeFile || _type == models.MetaTypeImage {
							movedUrl, err := cloudinaryup.MoveAssetIdToPublicFolder(p.Context, cleanVal)
							if err == nil {
								cleanVal = movedUrl
							} else {
								cleanVal = ""
							}
						}
						meta := models.TaskMeta{
							TaskID:    tsk.ID,
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
								TaskID:      tsk.ID,
								Description: strings.TrimSpace(desc),
								Status:      models.SubtaskStatusPending,
								SortOrder:   i,
							}
							repos.Subtask.Create(p.Context, &st)
						}
					}
				}

				createdTask, err := repos.Task.FindByID(p.Context, tsk.ID)
				if err != nil {
					return nil, err
				}
				return helpers.FormatTask(*createdTask, claims.Kodeku), nil
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
				id, err := helpers.ParseID(p.Args["id"])
				if err != nil {
					return nil, err
				}
				tsk, err := repos.Task.FindOwned(p.Context, id, claims.Kodeku)
				if err != nil {
					return nil, err
				}
				input := p.Args["input"].(map[string]interface{})
				if v, ok := input["title"]; ok && v != nil {
					tsk.Title = v.(string)
				}
				if v, ok := input["description"]; ok {
					tsk.Description = helpers.StrVal(v)
				}
				if v, ok := input["status"]; ok && v != nil {
					newStatus := v.(models.TaskStatus)
					if newStatus == models.TaskStatusCompleted && tsk.Status != models.TaskStatusCompleted {
						now := time.Now()
						tsk.CompletedAt = &now
					} else if newStatus != models.TaskStatusCompleted && tsk.Status == models.TaskStatusCompleted {
						tsk.CompletedAt = nil
					}
					tsk.Status = newStatus
				}
				if v, ok := input["startDate"]; ok {
					tsk.StartDate = helpers.ParseDatePtr(v)
				}
				if v, ok := input["dueDate"]; ok {
					tsk.DueDate = helpers.ParseDatePtr(v)
				}
				if err := repos.Task.Save(p.Context, tsk); err != nil {
					return nil, err
				}

				if metaList, ok := input["meta"].([]interface{}); ok {
					if err := repos.Meta.DeleteAllForTask(p.Context, tsk.ID); err == nil {
						for i, raw := range metaList {
							m := raw.(map[string]interface{})
							_type := m["type"].(models.MetaType)
							cleanVal := helpers.StrVal(m["value"])
							if (_type == models.MetaTypeFile || _type == models.MetaTypeImage) && cleanVal != "" && !strings.HasPrefix(cleanVal, "http") {
								movedUrl, err := cloudinaryup.MoveAssetIdToPublicFolder(p.Context, cleanVal)
								if err == nil {
									cleanVal = movedUrl
								}
							}
							meta := models.TaskMeta{
								TaskID:    tsk.ID,
								Key:       m["key"].(string),
								Value:     cleanVal,
								Type:      _type,
								SortOrder: i,
							}
							_ = repos.Meta.Create(p.Context, &meta)
						}
					}
				}
				updated, err := repos.Task.FindByID(p.Context, tsk.ID)
				if err != nil {
					return nil, err
				}
				return helpers.FormatTask(*updated, claims.Kodeku), nil
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
					id, err := helpers.ParseID(raw)
					if err == nil {
						orderedIDs = append(orderedIDs, id)
					}
				}
				res, err := repos.Task.Reorder(p.Context, claims.Kodeku, orderedIDs)
				if err != nil {
					return nil, err
				}
				return helpers.FormatTasks(res, claims.Kodeku), nil
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
				id, err := helpers.ParseID(p.Args["id"])
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
				taskID, err := helpers.ParseID(p.Args["taskId"])
				if err != nil {
					return nil, err
				}
				if _, err := repos.Task.FindOwned(p.Context, taskID, claims.Kodeku); err != nil {
					return nil, err
				}

				key := p.Args["key"].(string)
				value := helpers.StrVal(p.Args["value"])
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
				return helpers.FormatMeta(*meta), nil
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
				id, err := helpers.ParseID(p.Args["id"])
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
				taskID, err := helpers.ParseID(p.Args["taskId"])
				if err != nil {
					return nil, err
				}
				if _, err := repos.Task.FindOwned(p.Context, taskID, claims.Kodeku); err != nil {
					return false, err
				}

				idsRaw, _ := p.Args["orderedIds"].([]interface{})
				orderedIDs := make([]uint, 0, len(idsRaw))
				for _, raw := range idsRaw {
					id, err := helpers.ParseID(raw)
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

		"createSubtask": &graphql.Field{
			Type: t.SubtaskType,
			Args: graphql.FieldConfigArgument{
				"input": &graphql.ArgumentConfig{Type: graphql.NewNonNull(t.CreateSubtaskInput)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				input := p.Args["input"].(map[string]interface{})
				taskID, err := helpers.ParseID(input["taskId"])
				if err != nil {
					return nil, err
				}

				if _, err := repos.Task.FindOwned(p.Context, taskID, claims.Kodeku); err != nil {
					return nil, err
				}

				subtask := models.Subtask{
					TaskID:      taskID,
					Description: input["description"].(string),
					Status:      models.SubtaskStatusPending,
				}
				if status, ok := input["status"]; ok && status != nil {
					subtask.Status = status.(models.SubtaskStatus)
				}

				if err := repos.Subtask.Create(p.Context, &subtask); err != nil {
					return nil, err
				}
				return helpers.FormatSubtask(subtask), nil
			},
		},

		"updateSubtask": &graphql.Field{
			Type: t.SubtaskType,
			Args: graphql.FieldConfigArgument{
				"id":    &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"input": &graphql.ArgumentConfig{Type: graphql.NewNonNull(t.UpdateSubtaskInput)},
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

				subtask, err := repos.Subtask.FindByID(p.Context, id)
				if err != nil {
					return nil, err
				}
				if _, err := repos.Task.FindOwned(p.Context, subtask.TaskID, claims.Kodeku); err != nil {
					return nil, err
				}

				input := p.Args["input"].(map[string]interface{})
				if v, ok := input["description"]; ok && v != nil {
					subtask.Description = v.(string)
				}
				if v, ok := input["status"]; ok && v != nil {
					subtask.Status = v.(models.SubtaskStatus)
				}

				if err := repos.Subtask.Update(p.Context, subtask); err != nil {
					return nil, err
				}
				_, _ = repos.Subtask.CheckAndUpdateParentTaskCompletion(p.Context, subtask.TaskID)
				return helpers.FormatSubtask(*subtask), nil
			},
		},

		"deleteSubtask": &graphql.Field{
			Type: graphql.Boolean,
			Args: graphql.FieldConfigArgument{
				"id": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
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

				subtask, err := repos.Subtask.FindByID(p.Context, id)
				if err != nil {
					return nil, err
				}
				if _, err := repos.Task.FindOwned(p.Context, subtask.TaskID, claims.Kodeku); err != nil {
					return false, err
				}

				if err := repos.Subtask.Delete(p.Context, id); err != nil {
					return false, err
				}
				_, _ = repos.Subtask.CheckAndUpdateParentTaskCompletion(p.Context, subtask.TaskID)
				return true, nil
			},
		},

		"reorderSubtasks": &graphql.Field{
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
				taskID, err := helpers.ParseID(p.Args["taskId"])
				if err != nil {
					return nil, err
				}

				if _, err := repos.Task.FindOwned(p.Context, taskID, claims.Kodeku); err != nil {
					return false, err
				}

				idsRaw, _ := p.Args["orderedIds"].([]interface{})
				orderedIDs := make([]uint, 0, len(idsRaw))
				for _, raw := range idsRaw {
					id, err := helpers.ParseID(raw)
					if err == nil {
						orderedIDs = append(orderedIDs, id)
					}
				}

				if _, err := repos.Subtask.Reorder(p.Context, taskID, orderedIDs); err != nil {
					return false, err
				}
				return true, nil
			},
		},

		"addComment": &graphql.Field{
			Type: t.TaskCommentType,
			Args: graphql.FieldConfigArgument{
				"taskId":      &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"content":     &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
				"parentId":    &graphql.ArgumentConfig{Type: graphql.ID},
				"attachments": &graphql.ArgumentConfig{Type: graphql.NewList(t.CommentAttachmentInputType)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				taskID, err := helpers.ParseID(p.Args["taskId"])
				if err != nil {
					return nil, err
				}
				if _, err := repos.Task.FindOwned(p.Context, taskID, claims.Kodeku); err != nil {
					return nil, err
				}

				var parentIDPtr *uint
				if parentVal, ok := p.Args["parentId"]; ok && parentVal != nil {
					pid, err := helpers.ParseID(parentVal)
					if err != nil {
						return nil, err
					}
					parentIDPtr = &pid
				}

				content := p.Args["content"].(string)
				comment := &models.TaskComment{
					TaskID:   taskID,
					UserKode: claims.Kodeku,
					Content:  content,
					ParentID: parentIDPtr,
				}
				if err := repos.Comment.Create(p.Context, comment); err != nil {
					return nil, err
				}

				if attsRaw, ok := p.Args["attachments"].([]interface{}); ok && len(attsRaw) > 0 {
					for _, item := range attsRaw {
						m, ok := item.(map[string]interface{})
						if !ok {
							continue
						}
						url := m["url"].(string)
						fileName := m["fileName"].(string)
						fileType := helpers.StrVal(m["fileType"])
						var sizeBytes int64 = 0
						if sb, ok := m["sizeBytes"].(int); ok {
							sizeBytes = int64(sb)
						} else if sb, ok := m["sizeBytes"].(float64); ok {
							sizeBytes = int64(sb)
						}

						att := &models.CommentAttachment{
							CommentID: comment.ID,
							URL:       url,
							FileName:  fileName,
							FileType:  fileType,
							SizeBytes: sizeBytes,
						}
						_ = repos.Comment.CreateAttachment(p.Context, att)
					}
					refreshed, err := repos.Comment.FindByID(p.Context, comment.ID)
					if err == nil {
						comment = refreshed
					}
				}

				return helpers.FormatComment(*comment, claims.Kodeku), nil
			},
		},

		"toggleReaction": &graphql.Field{
			Type: t.TaskCommentType,
			Args: graphql.FieldConfigArgument{
				"commentId": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"emoji":     &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				commentID, err := helpers.ParseID(p.Args["commentId"])
				if err != nil {
					return nil, err
				}
				emoji := p.Args["emoji"].(string)

				if err := repos.Reaction.Toggle(p.Context, commentID, claims.Kodeku, emoji); err != nil {
					return nil, err
				}

				updated, err := repos.Comment.FindByID(p.Context, commentID)
				if err != nil {
					return nil, err
				}
				return helpers.FormatComment(*updated, claims.Kodeku), nil
			},
		},

		"deleteComment": &graphql.Field{
			Type: graphql.Boolean,
			Args: graphql.FieldConfigArgument{
				"id": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
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
				deleted, err := repos.Comment.Delete(p.Context, id, claims.Kodeku)
				if err != nil {
					return nil, err
				}
				return deleted, nil
			},
		},
	}
}
