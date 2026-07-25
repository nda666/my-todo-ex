package graph

import (
	"fmt"
	"strconv"
	"time"

	"golang-todo/internal/auth"
	"golang-todo/internal/libs/ai"
	"golang-todo/internal/repository"

	"github.com/graphql-go/graphql"
)

func doraMutationFields(repos *repository.Repositories, aiClient ai.Client, t *Types) graphql.Fields {
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
	}
}
