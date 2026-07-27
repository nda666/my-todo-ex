package dora

import (
	"fmt"
	"strconv"
	"time"

	"golang-todo/internal/auth"
	"golang-todo/internal/libs/ai"
	"golang-todo/internal/repository"

	"github.com/graphql-go/graphql"
)

var doraSessions = ai.NewSessionStore(60*time.Minute, 8)

func MutationFields(repos *repository.Repositories, aiClient ai.Client, t *Types) graphql.Fields {
	return graphql.Fields{
		"askDora": &graphql.Field{
			Type: t.DoraResponseType,
			Args: graphql.FieldConfigArgument{
				"message":   &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
				"sessionId": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}

				isLeader := false
				jabatanNama := ""
				if pegawai, err := repos.Pegawai.FindByKode(p.Context, claims.ExternalToken, claims.KodeDivisi, claims.PegawaiKode); err == nil {
					isLeader = pegawai.StatusLeader == 1
					if pegawai.Jabatan != nil {
						jabatanNama = pegawai.Jabatan.Nama
					}
				}

				userContext := ai.UserContext{
					Kodeku:           claims.Kodeku,
					Username:         claims.Username,
					Fullname:         claims.Fullname,
					KodeDivisi:       claims.KodeDivisi,
					NamaDivisi:       claims.NamaDivisi,
					PegawaiKode:      claims.PegawaiKode,
					IsDivisionLeader: isLeader,
					JabatanNama:      jabatanNama,
				}

				var colleagues []ai.ColleagueContext
				if isLeader {
					if members, err := repos.Pegawai.FindByDivisi(p.Context, claims.ExternalToken, claims.KodeDivisi); err == nil {
						colleagues = make([]ai.ColleagueContext, 0, len(members))
						for _, m := range members {
							jName := ""
							if m.Jabatan != nil {
								jName = m.Jabatan.Nama
							}
							colleagues = append(colleagues, ai.ColleagueContext{
								Kodeku:      strconv.Itoa(m.Kode),
								Nama:        m.Nama,
								JabatanNama: jName,
							})
						}
					}
				}

				var divisions []ai.DivisionContext
				if divisionsList, err := repos.Divisi.List(p.Context, claims.ExternalToken); err == nil {
					divisions = make([]ai.DivisionContext, 0, len(divisionsList))
					for _, d := range divisionsList {
						divisions = append(divisions, ai.DivisionContext{
							Kode: d.Kode,
							Nama: d.Nama,
						})
					}
				}

				allDivsTasks, _ := repos.Task.CountByAllDivisions(p.Context)
				doraTasks, err := repos.Task.FindDoraTasksContext(p.Context, claims.Kodeku, claims.KodeDivisi, isLeader)
				if err != nil {
					return nil, err
				}

				taskContexts := make([]ai.TaskContext, len(doraTasks))
				for i, tsk := range doraTasks {
					taskContexts[i] = ai.TaskContext{
						ID:             strconv.FormatUint(uint64(tsk.ID), 10),
						Title:          tsk.Title,
						Description:    tsk.Description,
						Status:         string(tsk.Status),
						AssigneeKodeku: tsk.UserKode,
						CreatedBy:      tsk.CreatedBy,
						CreatedAt:      tsk.CreatedAt.Format("2006-01-02"),
					}
				}

				doraProjects, _ := repos.Project.FindDoraProjectsContext(p.Context, claims.KodeDivisi)
				projectContexts := make([]ai.ProjectContext, len(doraProjects))
				for i, prj := range doraProjects {
					projectContexts[i] = ai.ProjectContext{
						ID:              strconv.FormatUint(uint64(prj.ID), 10),
						Name:            prj.Name,
						Description:     prj.Description,
						Stage:           string(prj.Stage),
						Status:          string(prj.Status),
						OwnerDivisiKode: prj.OwnerDivisiKode,
					}
				}

				message := p.Args["message"].(string)
				sessionID := p.Args["sessionId"].(string)

				history := doraSessions.History(sessionID)

				doraPrompt := ai.BuildDoraPrompt(userContext, colleagues, taskContexts, divisions, projectContexts, history, message, allDivsTasks)

				replyText, err := aiClient.GenerateText(p.Context, doraPrompt)
				if err != nil {
					return nil, fmt.Errorf("AI error: %w", err)
				}

				reply, action := ai.ParseDoraResponse(replyText)

				doraSessions.Append(sessionID, message, reply)

				var suggestedAction map[string]interface{}
				if action != nil {
					var tasksList []map[string]interface{}
					if len(action.Tasks) > 0 {
						tasksList = make([]map[string]interface{}, len(action.Tasks))
						for i, tsk := range action.Tasks {
							tasksList[i] = map[string]interface{}{
								"title":          tsk.Title,
								"description":    tsk.Description,
								"targetUserKode": tsk.TargetUserKode,
							}
						}
					}

					var divCandidatesList []map[string]interface{}
					if len(action.DivisionCandidates) > 0 {
						divCandidatesList = make([]map[string]interface{}, len(action.DivisionCandidates))
						for i, dc := range action.DivisionCandidates {
							divCandidatesList[i] = map[string]interface{}{
								"kode": dc.Kode,
								"nama": dc.Nama,
							}
						}
					}

					suggestedAction = map[string]interface{}{
						"type":               action.Type,
						"title":              action.Title,
						"description":        action.Description,
						"targetUserKode":     action.TargetUserKode,
						"startDate":          action.StartDate,
						"endDate":            action.EndDate,
						"styleNotes":         action.StyleNotes,
						"tasks":              tasksList,
						"divisions":          action.Divisions,
						"divisionCandidates": divCandidatesList,
					}
				}

				return map[string]interface{}{
					"reply":           reply,
					"suggestedAction": suggestedAction,
				}, nil
			},
		},
	}
}
