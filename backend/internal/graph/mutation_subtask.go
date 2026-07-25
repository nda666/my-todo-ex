package graph

import (
	"errors"

	"golang-todo/internal/auth"
	"golang-todo/internal/models"
	"golang-todo/internal/repository"

	"github.com/graphql-go/graphql"
)

func subtaskMutationFields(repos *repository.Repositories, t *Types) graphql.Fields {
	return graphql.Fields{
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
