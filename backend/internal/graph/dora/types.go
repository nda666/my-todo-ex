package dora

import (
	"github.com/graphql-go/graphql"
)

type Types struct {
	DoraResponseType        *graphql.Object
	DoraTaskItemType        *graphql.Object
	DoraSuggestedActionType *graphql.Object
	DoraMessageInputType    *graphql.InputObject
}

func BuildTypes() *Types {
	doraMessageInputType := graphql.NewInputObject(graphql.InputObjectConfig{
		Name: "DoraMessageInput",
		Fields: graphql.InputObjectConfigFieldMap{
			"role":    &graphql.InputObjectFieldConfig{Type: graphql.NewNonNull(graphql.String)},
			"content": &graphql.InputObjectFieldConfig{Type: graphql.NewNonNull(graphql.String)},
		},
	})

	doraTaskItemType := graphql.NewObject(graphql.ObjectConfig{
		Name: "DoraTaskItem",
		Fields: graphql.Fields{
			"title":          &graphql.Field{Type: graphql.String},
			"description":    &graphql.Field{Type: graphql.String},
			"targetUserKode": &graphql.Field{Type: graphql.String},
		},
	})

	doraDivisionCandidateType := graphql.NewObject(graphql.ObjectConfig{
		Name: "DoraDivisionCandidate",
		Fields: graphql.Fields{
			"kode": &graphql.Field{Type: graphql.Int},
			"nama": &graphql.Field{Type: graphql.String},
		},
	})

	doraSuggestedActionType := graphql.NewObject(graphql.ObjectConfig{
		Name: "DoraSuggestedAction",
		Fields: graphql.Fields{
			"type":               &graphql.Field{Type: graphql.String},
			"title":              &graphql.Field{Type: graphql.String},
			"description":        &graphql.Field{Type: graphql.String},
			"targetUserKode":     &graphql.Field{Type: graphql.String},
			"startDate":          &graphql.Field{Type: graphql.String},
			"endDate":            &graphql.Field{Type: graphql.String},
			"styleNotes":         &graphql.Field{Type: graphql.String},
			"tasks":              &graphql.Field{Type: graphql.NewList(doraTaskItemType)},
			"divisions":          &graphql.Field{Type: graphql.NewList(graphql.Int)},
			"divisionCandidates": &graphql.Field{Type: graphql.NewList(doraDivisionCandidateType)},
		},
	})

	doraResponseType := graphql.NewObject(graphql.ObjectConfig{
		Name: "DoraResponse",
		Fields: graphql.Fields{
			"reply":           &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"suggestedAction": &graphql.Field{Type: doraSuggestedActionType},
		},
	})

	return &Types{
		DoraResponseType:        doraResponseType,
		DoraTaskItemType:        doraTaskItemType,
		DoraSuggestedActionType: doraSuggestedActionType,
		DoraMessageInputType:    doraMessageInputType,
	}
}
