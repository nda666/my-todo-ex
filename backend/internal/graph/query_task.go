package graph

import (
	"strconv"
	"strings"
	"time"

	"golang-todo/internal/auth"
	"golang-todo/internal/repository"

	"github.com/graphql-go/graphql"
)

func taskQueryFields(repos *repository.Repositories, t *Types) graphql.Fields {
	return graphql.Fields{
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
					// scope ke divisi sendiri
					members, err := repos.Pegawai.FindByDivisi(p.Context, claims.ExternalToken, claims.KodeDivisi)
					if err != nil {
						opts.UserKode = &claims.Kodeku
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
	}
}
