package graph

import (
	"strconv"
	"strings"
	"time"

	"golang-todo/internal/auth"
	"golang-todo/internal/models"
	"golang-todo/internal/repository"

	"github.com/graphql-go/graphql"
)

func queryFields(repos *repository.Repositories, t *Types) graphql.Fields {
	return graphql.Fields{

		"me": &graphql.Field{
			Type: t.UserType,
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, nil
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
					Kodeku:    claims.Kodeku,
					Username:  claims.Username,
					AvatarURL: avatarURL,
					Pegawai: &models.Pegawai{
						Kode:         claims.PegawaiKode,
						Nama:         claims.Fullname,
						KodeDivisi:   claims.KodeDivisi,
						StatusLeader: statusLeader,
						Jabatan:      jabatan,
						Divisi:       &models.Divisi{Kode: claims.KodeDivisi, Nama: claims.NamaDivisi},
					},
				}
				return formatUser(user), nil
			},
		},

		"tasks": &graphql.Field{
			Type: t.TaskConnectionType,
			Args: graphql.FieldConfigArgument{
				"limit":     &graphql.ArgumentConfig{Type: graphql.Int},
				"cursor":    &graphql.ArgumentConfig{Type: graphql.String},
				"userKode":  &graphql.ArgumentConfig{Type: graphql.String},
				"search":    &graphql.ArgumentConfig{Type: graphql.String},
				"startDate": &graphql.ArgumentConfig{Type: graphql.String},
				"dueDate":   &graphql.ArgumentConfig{Type: graphql.String},
				"projectId": &graphql.ArgumentConfig{Type: graphql.ID},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}

				limit := 20
				if v, ok := p.Args["limit"].(int); ok && v > 0 {
					limit = v
				}
				var cursorID uint
				if v, ok := p.Args["cursor"].(string); ok && v != "" {
					if parsed, err := strconv.ParseUint(v, 10, 64); err == nil {
						cursorID = uint(parsed)
					}
				}

				opts := repository.TaskQueryOptions{CursorID: cursorID, Limit: limit}

				if search, ok := p.Args["search"].(string); ok && strings.TrimSpace(search) != "" {
					opts.Search = strings.TrimSpace(search)
				}

				if startDateStr, ok := p.Args["startDate"].(string); ok && startDateStr != "" {
					if parsed, err := time.Parse("2006-01-02", startDateStr); err == nil {
						opts.StartDate = &parsed
					}
				}

				if dueDateStr, ok := p.Args["dueDate"].(string); ok && dueDateStr != "" {
					if parsed, err := time.Parse("2006-01-02", dueDateStr); err == nil {
						eod := time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 23, 59, 59, 0, parsed.Location())
						opts.DueDate = &eod
					}
				}

				if projIDVal, ok := p.Args["projectId"].(string); ok && projIDVal != "" {
					if parsed, err := strconv.ParseUint(projIDVal, 10, 64); err == nil {
						pid := uint(parsed)
						opts.ProjectID = &pid
					}
				}

				if userKode, ok := p.Args["userKode"].(string); ok && userKode != "" {
					opts.UserKode = &userKode
				} else {
					// scope ke divisi sendiri: ambil daftar kode pegawai satu divisi, filter user_kode IN (...)
					members, err := repos.Pegawai.FindByDivisi(p.Context, claims.ExternalToken, claims.KodeDivisi)
					if err != nil {
						opts.UserKode = &claims.Kodeku // fallback: kalau gagal fetch directory, minimal task sendiri tetap tampil
					} else {
						kodes := make([]string, len(members))
						for i, m := range members {
							kodes[i] = strconv.Itoa(m.Kode)
						}
						opts.UserKodeIn = kodes
					}
				}

				tasks, err := repos.Task.FindPaginated(p.Context, opts)
				if err != nil {
					return nil, err
				}

				hasMore := len(tasks) > limit
				if hasMore {
					tasks = tasks[:limit]
				}
				nextCursor := ""
				if hasMore && len(tasks) > 0 {
					nextCursor = strconv.FormatUint(uint64(tasks[len(tasks)-1].ID), 10)
				}

				return map[string]interface{}{
					"tasks":      formatTasks(tasks, claims.Kodeku),
					"nextCursor": nextCursor,
					"hasMore":    hasMore,
				}, nil
			},
		},

		"colleagues": &graphql.Field{
			Type: graphql.NewList(graphql.NewNonNull(t.ColleagueType)),
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				members, err := repos.Pegawai.FindByDivisi(p.Context, claims.ExternalToken, claims.KodeDivisi)
				if err != nil {
					return nil, err
				}
				result := make([]map[string]interface{}, len(members))
				for i, m := range members {
					result[i] = formatColleague(m)
				}
				return result, nil
			},
		},

		"projects": &graphql.Field{
			Type: graphql.NewList(graphql.NewNonNull(t.ProjectType)),
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				projects, err := repos.Project.FindByDivisi(p.Context, claims.KodeDivisi)
				if err != nil {
					return nil, err
				}
				return formatProjects(projects), nil
			},
		},

		"project": &graphql.Field{
			Type: t.ProjectType,
			Args: graphql.FieldConfigArgument{
				"id": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				if _, err := auth.RequireUser(p.Context); err != nil {
					return nil, err
				}
				id, err := parseID(p.Args["id"])
				if err != nil {
					return nil, err
				}
				project, err := repos.Project.FindByID(p.Context, id)
				if err != nil {
					return nil, err
				}
				return formatProject(*project), nil
			},
		},

		"projectTasks": &graphql.Field{
			Type: t.TaskConnectionType,
			Args: graphql.FieldConfigArgument{
				"projectId": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
				"limit":     &graphql.ArgumentConfig{Type: graphql.Int},
				"cursor":    &graphql.ArgumentConfig{Type: graphql.String},
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

				limit := 20
				if v, ok := p.Args["limit"].(int); ok && v > 0 {
					limit = v
				}
				var cursorID uint
				if v, ok := p.Args["cursor"].(string); ok && v != "" {
					if parsed, err := strconv.ParseUint(v, 10, 64); err == nil {
						cursorID = uint(parsed)
					}
				}

				tasks, err := repos.Task.FindByProjectID(p.Context, projectID, cursorID, limit+1)
				if err != nil {
					return nil, err
				}

				hasMore := len(tasks) > limit
				if hasMore {
					tasks = tasks[:limit]
				}
				nextCursor := ""
				if hasMore && len(tasks) > 0 {
					nextCursor = strconv.FormatUint(uint64(tasks[len(tasks)-1].ID), 10)
				}

				return map[string]interface{}{
					"tasks":      formatTasks(tasks, claims.Kodeku),
					"nextCursor": nextCursor,
					"hasMore":    hasMore,
				}, nil
			},
		},

		"colleaguesByDivisi": &graphql.Field{
			Type: graphql.NewList(graphql.NewNonNull(t.ColleagueType)),
			Args: graphql.FieldConfigArgument{
				"divisiKode": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.Int)},
				"search":     &graphql.ArgumentConfig{Type: graphql.String},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				divisiKode := p.Args["divisiKode"].(int)
				var search *string
				if v, ok := p.Args["search"]; ok {
					s := v.(string)
					search = &s
				}
				members, err := repos.Pegawai.FindByDivisiAndSearchName(p.Context, claims.ExternalToken, divisiKode, search)
				if err != nil {
					return nil, err
				}
				result := make([]map[string]interface{}, len(members))
				for i, m := range members {
					result[i] = formatColleague(m)
				}
				return result, nil
			},
		},

		"divisions": &graphql.Field{
			Type: graphql.NewList(graphql.NewNonNull(t.DivisiType)),
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				divisions, err := repos.Divisi.List(p.Context, claims.ExternalToken)
				if err != nil {
					return nil, err
				}
				result := make([]map[string]interface{}, len(divisions))
				for i, d := range divisions {
					result[i] = map[string]interface{}{"kode": d.Kode, "nama": d.Nama}
				}
				return result, nil
			},
		},

		"teamsSummary": &graphql.Field{
			Type: graphql.NewList(graphql.NewNonNull(t.DivisionSummaryType)),
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				claims, err := auth.RequireUser(p.Context)
				if err != nil {
					return nil, err
				}
				summaries, err := repos.Divisi.Summaries(p.Context, claims.ExternalToken)
				if err != nil {
					return nil, err
				}
				result := make([]map[string]interface{}, len(summaries))
				for i, s := range summaries {
					iconKey, color, _ := repos.DivisiIcon.GetOrCompute(p.Context, s.Kode, s.Nama)
					result[i] = map[string]interface{}{
						"kode": s.Kode, "nama": s.Nama, "leaderName": s.LeaderName,
						"memberCount": s.MemberCount, "iconKey": iconKey, "color": color,
					}
				}
				return result, nil
			},
		},
	}
}
