package graph

import (
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"golang-todo/internal/auth"
	"golang-todo/internal/libs/ai"
	"golang-todo/internal/libs/cloudinaryup"
	"golang-todo/internal/models"
	"golang-todo/internal/repository"

	"github.com/graphql-go/graphql"
)

func mutationFields(repos *repository.Repositories, authService *auth.Service, aiClient ai.Client, projectPolicy auth.ProjectPolicy, t *Types) graphql.Fields {

	return graphql.Fields{
		"login": &graphql.Field{
			Type: t.AuthPayloadType,
			Args: graphql.FieldConfigArgument{
				"username": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
				"password": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				username := p.Args["username"].(string)
				password := p.Args["password"].(string)
				token, err := authService.Login(p.Context, username, password)
				if err != nil {
					return nil, err
				}
				claims, err := authService.ParseToken(token)
				if err != nil {
					return nil, err
				}

				var jabatan *models.Jabatan
				statusLeader := 0
				if pegawai, err := repos.Pegawai.FindByKode(p.Context, claims.ExternalToken, claims.KodeDivisi, claims.PegawaiKode); err == nil {
					jabatan = pegawai.Jabatan
					statusLeader = pegawai.StatusLeader
				}
				avatarURL := claims.AvatarURL
				if custom, ok, _ := repos.Profile.GetAvatar(p.Context, claims.Kodeku); ok && custom != "" {
					avatarURL = custom
				}

				user := models.User{
					Kodeku: claims.Kodeku, Username: claims.Username, AvatarURL: avatarURL,
					Pegawai: &models.Pegawai{
						Kode: claims.PegawaiKode, Nama: claims.Fullname, KodeDivisi: claims.KodeDivisi,
						StatusLeader: statusLeader, Jabatan: jabatan,
						Divisi: &models.Divisi{Kode: claims.KodeDivisi, Nama: claims.NamaDivisi},
					},
				}
				return map[string]interface{}{"token": token, "user": formatUser(user)}, nil
			},
		},

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
						targetUserKode = claims.Kodeku // target gak ketemu di divisi yang sama -> fallback ke diri sendiri
					}
				}

				task := models.Task{
					Title:       input["title"].(string),
					Description: strVal(input["description"]),
					Status:      models.TaskStatusPending,
					UserKode:    targetUserKode,
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
						task.CompletedAt = nil // dibatalkan -> kosongkan lagi (requirement eksplisit)
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

		"addTaskComment": &graphql.Field{
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
				taskID, err := parseID(p.Args["taskId"])
				if err != nil {
					return nil, err
				}

				if _, err := repos.Task.FindByID(p.Context, taskID); err != nil {
					return nil, errors.New("task not found")
				}

				comment := models.TaskComment{
					TaskID:   taskID,
					UserKode: claims.Kodeku,
					Content:  p.Args["content"].(string),
				}
				if v, ok := p.Args["parentId"]; ok && v != nil {
					pid, err := parseID(v)
					if err == nil {
						comment.ParentID = &pid
					}
				}
				if err := repos.Comment.Create(p.Context, &comment); err != nil {
					return nil, err
				}

				if attachments, ok := p.Args["attachments"].([]interface{}); ok {
					for i, raw := range attachments {
						if i >= 3 {
							break
						}
						a := raw.(map[string]interface{})
						size := 0
						if v, ok := a["sizeBytes"]; ok && v != nil {
							size = v.(int)
						}
						fileType := ""
						if v, ok := a["fileType"]; ok && v != nil {
							fileType = v.(string)
						}
						att := models.CommentAttachment{
							CommentID: comment.ID,
							URL:       a["url"].(string),
							FileName:  a["fileName"].(string),
							FileType:  fileType,
							SizeBytes: int64(size),
						}
						repos.Comment.CreateAttachment(p.Context, &att)
					}
				}

				created, err := repos.Comment.FindByID(p.Context, comment.ID)
				if err != nil {
					return nil, err
				}
				return formatComment(*created, claims.Kodeku), nil
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
				commentID, err := parseID(p.Args["commentId"])
				if err != nil {
					return nil, err
				}
				emoji := p.Args["emoji"].(string)

				if err := repos.Reaction.Toggle(p.Context, commentID, claims.Kodeku, emoji); err != nil {
					return nil, err
				}

				comment, err := repos.Comment.FindByID(p.Context, commentID)
				if err != nil {
					return nil, err
				}
				return formatComment(*comment, claims.Kodeku), nil
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

		"askDora": &graphql.Field{
			Type: t.DoraResponseType,
			Args: graphql.FieldConfigArgument{
				"message":   &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
				"sessionId": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)}, // <-- ganti dari "history"
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}

				isLeader := false
				jabatanNama := ""
				var teamMembers []ai.TeamMember

				if pegawai, err := repos.Pegawai.FindByKode(p.Context, claims.ExternalToken, claims.KodeDivisi, claims.PegawaiKode); err == nil {
					isLeader = pegawai.StatusLeader == 1
					if pegawai.Jabatan != nil {
						jabatanNama = pegawai.Jabatan.Nama
					}
				}

				if members, err := repos.Pegawai.FindByDivisi(p.Context, claims.ExternalToken, claims.KodeDivisi); err == nil {
					for _, m := range members {
						if m.Kode != claims.PegawaiKode {
							teamMembers = append(teamMembers, ai.TeamMember{Kodeku: strconv.Itoa(m.Kode), Nama: m.Nama})
						}
					}
				}

				var divisionInfos []ai.DivisionInfo
				if allDivisions, err := repos.Divisi.List(p.Context, claims.ExternalToken); err == nil {
					for _, d := range allDivisions {
						if d.Kode != claims.KodeDivisi {
							divisionInfos = append(divisionInfos, ai.DivisionInfo{Kode: d.Kode, Nama: d.Nama})
						}
					}
				}

				today := time.Now().Format("2006-01-02")
				systemPrompt := ai.BuildSystemPrompt(ai.UserContext{
					Kodeku:     claims.Kodeku,
					Nama:       claims.Fullname,
					Jabatan:    jabatanNama,
					DivisiNama: claims.NamaDivisi,
					IsLeader:   isLeader,
				}, teamMembers, divisionInfos, today)

				sessionID := claims.Kodeku + ":" + p.Args["sessionId"].(string)

				messages := []ai.ChatMessage{
					{Role: "system", Content: systemPrompt},
				}

				messages = append(messages, doraSessions.History(sessionID)...)

				userMsg := ai.ChatMessage{Role: "user", Content: p.Args["message"].(string)}
				messages = append(messages, userMsg)

				rawReply, err := aiClient.Complete(p.Context, messages, sessionID)
				if err != nil {
					return nil, fmt.Errorf("Dora sedang tidak bisa merespons, coba lagi sebentar lagi")
				}

				cleanReply, action := ai.ExtractAction(rawReply)
				doraSessions.Append(sessionID, userMsg, ai.ChatMessage{Role: "assistant", Content: rawReply})

				result := map[string]interface{}{"reply": cleanReply}
				if action != nil {
					suggested := map[string]interface{}{
						"type":           action.Type,
						"title":          action.Title,
						"description":    action.Description,
						"targetUserKode": action.TargetUserKode,
					}
					switch action.Type {
					case "generate_report":
						suggested["startDate"] = action.StartDate
						suggested["endDate"] = action.EndDate
						suggested["styleNotes"] = action.StyleNotes
					case "create_task_batch":
						tasks := make([]map[string]interface{}, len(action.Tasks))
						for i, item := range action.Tasks {
							tasks[i] = map[string]interface{}{
								"title":          item.Title,
								"description":    item.Description,
								"targetUserKode": item.TargetUserKode,
							}
						}
						suggested["tasks"] = tasks
					case "create_project":
						validKodes := make(map[int]bool, len(divisionInfos))
						for _, d := range divisionInfos {
							validKodes[d.Kode] = true
						}
						filtered := make([]int, 0, len(action.Divisions))
						for _, kode := range action.Divisions {
							if validKodes[kode] {
								filtered = append(filtered, kode)
							}
						}
						suggested["divisions"] = filtered
					case "recommend_divisions":
						namaByKode := make(map[int]string, len(divisionInfos))
						for _, d := range divisionInfos {
							namaByKode[d.Kode] = d.Nama
						}
						candidates := make([]map[string]interface{}, 0, len(action.DivisionCandidates))
						for _, c := range action.DivisionCandidates {
							if nama, ok := namaByKode[c.Kode]; ok {
								candidates = append(candidates, map[string]interface{}{"kode": c.Kode, "nama": nama})
							}
						}
						suggested["divisionCandidates"] = candidates
					}
					result["suggestedAction"] = suggested
				}
				return result, nil
			},
		},
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

				task := models.Task{
					Title:       p.Args["title"].(string),
					Description: strVal(p.Args["description"]),
					Status:      models.TaskStatusPending,
					UserKode:    targetUserKode,
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

		"createSubtask": &graphql.Field{
			Type: t.SubtaskType,
			Args: graphql.FieldConfigArgument{
				"input": &graphql.ArgumentConfig{Type: graphql.NewNonNull(t.CreateSubtaskInput)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				_, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				input := p.Args["input"].(map[string]interface{})
				taskID, err := parseID(input["taskId"])
				if err != nil {
					return nil, errors.New("invalid taskId")
				}
				desc, _ := input["description"].(string)
				if desc == "" {
					return nil, errors.New("description is required")
				}
				subtask := models.Subtask{
					TaskID:      taskID,
					Description: desc,
					Status:      models.SubtaskStatusPending,
				}
				if statusVal, ok := input["status"]; ok && statusVal != nil {
					subtask.Status = statusVal.(models.SubtaskStatus)
				}

				if err := repos.Subtask.Create(p.Context, &subtask); err != nil {
					return nil, err
				}

				_, _ = repos.Subtask.CheckAndUpdateParentTaskCompletion(p.Context, taskID)

				return formatSubtask(subtask), nil
			},
		},

		"updateSubtask": &graphql.Field{
			Type: t.SubtaskType,
			Args: graphql.FieldConfigArgument{
				"id":    &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"input": &graphql.ArgumentConfig{Type: graphql.NewNonNull(t.UpdateSubtaskInput)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				_, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				id, err := parseID(p.Args["id"])
				if err != nil {
					return nil, errors.New("invalid id")
				}
				subtask, err := repos.Subtask.FindByID(p.Context, id)
				if err != nil {
					return nil, err
				}

				input := p.Args["input"].(map[string]interface{})
				if descVal, ok := input["description"]; ok && descVal != nil {
					subtask.Description = descVal.(string)
				}
				if statusVal, ok := input["status"]; ok && statusVal != nil {
					subtask.Status = statusVal.(models.SubtaskStatus)
				}

				if err := repos.Subtask.Update(p.Context, subtask); err != nil {
					return nil, err
				}

				_, _ = repos.Subtask.CheckAndUpdateParentTaskCompletion(p.Context, subtask.TaskID)

				return formatSubtask(*subtask), nil
			},
		},

		"deleteSubtask": &graphql.Field{
			Type: graphql.Boolean,
			Args: graphql.FieldConfigArgument{
				"id": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				_, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				id, err := parseID(p.Args["id"])
				if err != nil {
					return nil, errors.New("invalid id")
				}
				subtask, err := repos.Subtask.FindByID(p.Context, id)
				if err != nil {
					return nil, err
				}
				taskID := subtask.TaskID

				if err := repos.Subtask.Delete(p.Context, id); err != nil {
					return nil, err
				}

				_, _ = repos.Subtask.CheckAndUpdateParentTaskCompletion(p.Context, taskID)

				return true, nil
			},
		},

		"reorderSubtasks": &graphql.Field{
			Type: graphql.NewList(t.SubtaskType),
			Args: graphql.FieldConfigArgument{
				"taskId":     &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"orderedIds": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.NewList(graphql.NewNonNull(graphql.ID)))},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				_, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				taskID, err := parseID(p.Args["taskId"])
				if err != nil {
					return nil, errors.New("invalid taskId")
				}
				rawIDs, ok := p.Args["orderedIds"].([]interface{})
				if !ok {
					return nil, errors.New("invalid orderedIds format")
				}
				var orderedIDs []uint
				for _, raw := range rawIDs {
					id, err := parseID(raw)
					if err == nil {
						orderedIDs = append(orderedIDs, id)
					}
				}

				updated, err := repos.Subtask.Reorder(p.Context, taskID, orderedIDs)
				if err != nil {
					return nil, err
				}
				formatted := make([]map[string]interface{}, len(updated))
				for i, s := range updated {
					formatted[i] = formatSubtask(s)
				}
				return formatted, nil
			},
		},
	}
}
