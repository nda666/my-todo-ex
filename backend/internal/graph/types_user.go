package graph

import (
	"github.com/graphql-go/graphql"
)

type userTypes struct {
	JabatanType         *graphql.Object
	DivisiType          *graphql.Object
	DivisionSummaryType *graphql.Object
	PegawaiType         *graphql.Object
	ColleagueType       *graphql.Object
	UserType            *graphql.Object
	AuthPayloadType     *graphql.Object
}

func buildUserTypes() userTypes {
	jabatanType := graphql.NewObject(graphql.ObjectConfig{
		Name: "Jabatan",
		Fields: graphql.Fields{
			"kode": &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"nama": &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
		},
	})

	divisiType := graphql.NewObject(graphql.ObjectConfig{
		Name: "Divisi",
		Fields: graphql.Fields{
			"kode": &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"nama": &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
		},
	})

	divisionSummaryType := graphql.NewObject(graphql.ObjectConfig{
		Name: "DivisionSummary",
		Fields: graphql.Fields{
			"kode":        &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"nama":        &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"leaderName":  &graphql.Field{Type: graphql.String},
			"memberCount": &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"iconKey":     &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"color":       &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
		},
	})

	pegawaiType := graphql.NewObject(graphql.ObjectConfig{
		Name: "Pegawai",
		Fields: graphql.Fields{
			"kode":         &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"nama":         &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"kodejabatan":  &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"kodedivisi":   &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"statusLeader": &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"jabatan":      &graphql.Field{Type: jabatanType},
			"divisi":       &graphql.Field{Type: divisiType},
		},
	})

	colleagueType := graphql.NewObject(graphql.ObjectConfig{
		Name: "Colleague",
		Fields: graphql.Fields{
			"kodeku":       &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"nama":         &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"jabatan":      &graphql.Field{Type: jabatanType},
			"statusLeader": &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"avatarUrl":    &graphql.Field{Type: graphql.String},
		},
	})

	userType := graphql.NewObject(graphql.ObjectConfig{
		Name: "User",
		Fields: graphql.Fields{
			"kodeku":    &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"username":  &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"pegawai":   &graphql.Field{Type: pegawaiType},
			"avatarUrl": &graphql.Field{Type: graphql.String},
		},
	})

	authPayloadType := graphql.NewObject(graphql.ObjectConfig{
		Name: "AuthPayload",
		Fields: graphql.Fields{
			"token": &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"user":  &graphql.Field{Type: graphql.NewNonNull(userType)},
		},
	})

	return userTypes{
		JabatanType:         jabatanType,
		DivisiType:          divisiType,
		DivisionSummaryType: divisionSummaryType,
		PegawaiType:         pegawaiType,
		ColleagueType:       colleagueType,
		UserType:            userType,
		AuthPayloadType:     authPayloadType,
	}
}
