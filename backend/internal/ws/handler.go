package ws

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"

	"golang-todo/internal/auth"

	"github.com/gorilla/websocket"
	"github.com/graphql-go/graphql"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allowed via CORS
	},
	Subprotocols: []string{"graphql-transport-ws", "graphql-ws"},
}

type SafeConn struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func (c *SafeConn) WriteJSON(v interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.conn.WriteJSON(v)
}

func (c *SafeConn) Close() error {
	return c.conn.Close()
}

type Message struct {
	ID      string          `json:"id,omitempty"`
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type SubscribePayload struct {
	Query         string                 `json:"query"`
	Variables     map[string]interface{} `json:"variables,omitempty"`
	OperationName string                 `json:"operationName,omitempty"`
}

type Handler struct {
	schema      *graphql.Schema
	authService *auth.Service
}

func NewHandler(schema *graphql.Schema, authService *auth.Service) *Handler {
	return &Handler{
		schema:      schema,
		authService: authService,
	}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	subprotocol := ""
	for _, sp := range websocket.Subprotocols(r) {
		if sp == "graphql-transport-ws" || sp == "graphql-ws" {
			subprotocol = sp
			break
		}
	}

	responseHeader := http.Header{}
	if subprotocol != "" {
		responseHeader.Set("Sec-WebSocket-Protocol", subprotocol)
	}

	rawConn, err := upgrader.Upgrade(w, r, responseHeader)
	if err != nil {
		log.Printf("WS upgrade error: %v", err)
		return
	}

	conn := &SafeConn{conn: rawConn}
	defer conn.Close()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	// Check token from HTTP headers or query param if present
	tokenStr := ""
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
	} else if qToken := r.URL.Query().Get("token"); qToken != "" {
		tokenStr = qToken
	}

	if tokenStr != "" {
		if claims, err := h.authService.ParseToken(tokenStr); err == nil {
			ctx = context.WithValue(ctx, auth.UserContextKey, claims)
		}
	}

	activeSubs := make(map[string]context.CancelFunc)
	var subsMu sync.Mutex

	isLegacyProto := subprotocol == "graphql-ws"

	for {
		_, rawMsg, err := rawConn.ReadMessage()
		if err != nil {
			break
		}

		var msg Message
		if err := json.Unmarshal(rawMsg, &msg); err != nil {
			continue
		}

		switch msg.Type {
		case "connection_init":
			// Extract token from payload if provided
			if len(msg.Payload) > 0 {
				var payloadMap map[string]interface{}
				if err := json.Unmarshal(msg.Payload, &payloadMap); err == nil {
					var rawToken string
					if v, ok := payloadMap["authorization"].(string); ok {
						rawToken = v
					} else if v, ok := payloadMap["Authorization"].(string); ok {
						rawToken = v
					} else if v, ok := payloadMap["authToken"].(string); ok {
						rawToken = v
					} else if v, ok := payloadMap["token"].(string); ok {
						rawToken = v
					}

					rawToken = strings.TrimPrefix(rawToken, "Bearer ")
					rawToken = strings.TrimSpace(rawToken)
					if rawToken != "" {
						if claims, err := h.authService.ParseToken(rawToken); err == nil {
							ctx = context.WithValue(ctx, auth.UserContextKey, claims)
						}
					}
				}
			}

			_ = conn.WriteJSON(map[string]interface{}{
				"type": "connection_ack",
			})

		case "ping":
			_ = conn.WriteJSON(map[string]interface{}{
				"type": "pong",
			})

		case "subscribe", "start":
			var subPayload SubscribePayload
			if err := json.Unmarshal(msg.Payload, &subPayload); err != nil {
				_ = conn.WriteJSON(map[string]interface{}{
					"id":   msg.ID,
					"type": "error",
					"payload": []map[string]string{
						{"message": "Invalid subscribe payload: " + err.Error()},
					},
				})
				continue
			}

			subCtx, subCancel := context.WithCancel(ctx)
			subsMu.Lock()
			if oldCancel, exists := activeSubs[msg.ID]; exists {
				oldCancel()
			}
			activeSubs[msg.ID] = subCancel
			subsMu.Unlock()

			go func(subID string, sCtx context.Context, payload SubscribePayload) {
				defer func() {
					subsMu.Lock()
					delete(activeSubs, subID)
					subsMu.Unlock()
				}()

				resultChan := graphql.Subscribe(graphql.Params{
					Schema:         *h.schema,
					RequestString:  payload.Query,
					VariableValues: payload.Variables,
					OperationName:  payload.OperationName,
					Context:        sCtx,
				})

				dataMsgType := "next"
				if isLegacyProto {
					dataMsgType = "data"
				}

				for {
					select {
					case <-sCtx.Done():
						return
					case result, ok := <-resultChan:
						if !ok {
							_ = conn.WriteJSON(map[string]interface{}{
								"id":   subID,
								"type": "complete",
							})
							return
						}
						_ = conn.WriteJSON(map[string]interface{}{
							"id":   subID,
							"type": dataMsgType,
							"payload": map[string]interface{}{
								"data":   result.Data,
								"errors": result.Errors,
							},
						})
					}
				}
			}(msg.ID, subCtx, subPayload)

		case "complete", "stop":
			subsMu.Lock()
			if cancelSub, exists := activeSubs[msg.ID]; exists {
				cancelSub()
				delete(activeSubs, msg.ID)
			}
			subsMu.Unlock()
		}
	}

	// Clean up any remaining subscriptions on disconnect
	subsMu.Lock()
	for _, cancelSub := range activeSubs {
		cancelSub()
	}
	subsMu.Unlock()
}
