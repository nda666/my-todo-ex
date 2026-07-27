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
					Kodeku:     claims.Kodeku,
					Nama:       claims.Fullname,
					Jabatan:    jabatanNama,
					DivisiNama: claims.NamaDivisi,
					IsLeader:   isLeader,
				}

				var teamMembers []ai.TeamMember
				if isLeader {
					if members, err := repos.Pegawai.FindByDivisi(p.Context, claims.ExternalToken, claims.KodeDivisi); err == nil {
						teamMembers = make([]ai.TeamMember, 0, len(members))
						for _, m := range members {
							teamMembers = append(teamMembers, ai.TeamMember{
								Kodeku: strconv.Itoa(m.Kode),
								Nama:   m.Nama,
							})
						}
					}
				}

				var divisions []ai.DivisionInfo
				if divisionsList, err := repos.Divisi.List(p.Context, claims.ExternalToken); err == nil {
					divisions = make([]ai.DivisionInfo, 0, len(divisionsList))
					for _, d := range divisionsList {
						divisions = append(divisions, ai.DivisionInfo{
							Kode: d.Kode,
							Nama: d.Nama,
						})
					}
				}

				message := p.Args["message"].(string)
				sessionID := p.Args["sessionId"].(string)

				today := time.Now().Format("2006-01-02")
				systemPrompt := ai.BuildSystemPrompt(userContext, teamMembers, divisions, today)

				history := doraSessions.History(sessionID)

				messages := make([]ai.ChatMessage, 0, len(history)+2)
				messages = append(messages, ai.ChatMessage{Role: "system", Content: systemPrompt})
				messages = append(messages, history...)
				messages = append(messages, ai.ChatMessage{Role: "user", Content: message})

				replyText, err := aiClient.Complete(p.Context, messages, sessionID)
				if err != nil {
					return nil, fmt.Errorf("AI error: %w", err)
				}

				cleanReply, action := ai.ExtractAction(replyText)

				doraSessions.Append(sessionID, ai.ChatMessage{Role: "user", Content: message}, ai.ChatMessage{Role: "assistant", Content: replyText})

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
					"reply":           cleanReply,
					"suggestedAction": suggestedAction,
				}, nil
			},
		},
	}
}
