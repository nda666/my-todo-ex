package task

import (
	"golang-todo/internal/auth"
	"golang-todo/internal/libs/pubsub"

	"github.com/graphql-go/graphql"
)

func SubscriptionFields(t *Types) graphql.Fields {
	return graphql.Fields{
		"taskEvent": &graphql.Field{
			Type: t.TaskEventPayloadType,
			Args: graphql.FieldConfigArgument{
				"divisiKode": &graphql.ArgumentConfig{Type: graphql.Int},
			},
			Subscribe: func(p graphql.ResolveParams) (interface{}, error) {
				claims, _ := auth.UserFromContext(p.Context)
				divisiKode := 0
				if claims != nil {
					divisiKode = claims.KodeDivisi
				}
				if arg, ok := p.Args["divisiKode"].(int); ok && arg > 0 {
					divisiKode = arg
				}

				eventCh, unsub := pubsub.DefaultBroker.Subscribe(divisiKode)
				out := make(chan interface{}, 20)

				go func() {
					defer unsub()
					defer close(out)
					for {
						select {
						case <-p.Context.Done():
							return
						case ev, ok := <-eventCh:
							if !ok {
								return
							}
							select {
							case out <- ev:
							case <-p.Context.Done():
								return
							}
						}
					}
				}()

				return out, nil
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				ev, ok := p.Source.(*pubsub.TaskEvent)
				if !ok || ev == nil {
					return nil, nil
				}
				return map[string]interface{}{
					"action": string(ev.Action),
					"task":   ev.Task,
					"taskId": ev.TaskID,
				}, nil
			},
		},
		"taskUpdated": &graphql.Field{
			Type: t.TaskType,
			Args: graphql.FieldConfigArgument{
				"divisiKode": &graphql.ArgumentConfig{Type: graphql.Int},
			},
			Subscribe: func(p graphql.ResolveParams) (interface{}, error) {
				claims, _ := auth.UserFromContext(p.Context)
				divisiKode := 0
				if claims != nil {
					divisiKode = claims.KodeDivisi
				}
				if arg, ok := p.Args["divisiKode"].(int); ok && arg > 0 {
					divisiKode = arg
				}

				eventCh, unsub := pubsub.DefaultBroker.Subscribe(divisiKode)
				out := make(chan interface{}, 20)

				go func() {
					defer unsub()
					defer close(out)
					for {
						select {
						case <-p.Context.Done():
							return
						case ev, ok := <-eventCh:
							if !ok {
								return
							}
							if ev.Action == pubsub.TaskUpdated {
								select {
								case out <- ev:
								case <-p.Context.Done():
									return
								}
							}
						}
					}
				}()

				return out, nil
			},
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				ev, ok := p.Source.(*pubsub.TaskEvent)
				if !ok || ev == nil {
					return nil, nil
				}
				return ev.Task, nil
			},
		},
	}
}
