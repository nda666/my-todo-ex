package graph

import (
	"strconv"

	"golang-todo/internal/auth"
	"golang-todo/internal/repository"

	"github.com/graphql-go/graphql"
)

func projectQueryFields(repos *repository.Repositories, t *Types) graphql.Fields {
	return graphql.Fields{
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
				divProgress, _ := repos.Project.GetDivisionProgress(p.Context, id)
				return formatProjectWithDetails(*project, divProgress), nil
			},
		},

		"projectDivisionProgress": &graphql.Field{
			Type: graphql.NewList(graphql.NewNonNull(t.DivisionProgressType)),
			Args: graphql.FieldConfigArgument{
				"projectId": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.ID)},
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				if _, err := auth.RequireUser(p.Context); err != nil {
					return nil, err
				}
				id, err := parseID(p.Args["projectId"])
				if err != nil {
					return nil, err
				}
				progress, err := repos.Project.GetDivisionProgress(p.Context, id)
				if err != nil {
					return nil, err
				}
				result := make([]map[string]interface{}, len(progress))
				for i, dp := range progress {
					result[i] = formatDivisionProgress(dp)
				}
				return result, nil
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
	}
}
