package graph

import (
	"golang-todo/internal/repository"

	"github.com/graphql-go/graphql"
)

func queryFields(repos *repository.Repositories, t *Types) graphql.Fields {
	fields := graphql.Fields{}

	// User & Organization Queries
	for k, v := range userQueryFields(repos, t) {
		fields[k] = v
	}

	// Task Queries
	for k, v := range taskQueryFields(repos, t) {
		fields[k] = v
	}

	// Project Queries
	for k, v := range projectQueryFields(repos, t) {
		fields[k] = v
	}

	return fields
}
