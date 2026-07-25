package graph

import (
	"golang-todo/internal/auth"
	"golang-todo/internal/models"
	"golang-todo/internal/repository"

	"github.com/graphql-go/graphql"
)

func userQueryFields(repos *repository.Repositories, t *Types) graphql.Fields {
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
