package graph

import (
	"errors"

	"golang-todo/internal/auth"
	"golang-todo/internal/models"
	"golang-todo/internal/repository"

	"github.com/graphql-go/graphql"
)

func commentMutationFields(repos *repository.Repositories, t *Types) graphql.Fields {
	return graphql.Fields{
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
	}
}
