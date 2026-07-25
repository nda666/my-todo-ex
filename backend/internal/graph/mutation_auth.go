package graph

import (
	"golang-todo/internal/auth"
	"golang-todo/internal/models"
	"golang-todo/internal/repository"

	"github.com/graphql-go/graphql"
)

func authMutationFields(repos *repository.Repositories, authService *auth.Service, t *Types) graphql.Fields {
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
	}
}
