package ai

import (
	"testing"
)

func TestExtractAction(t *testing.T) {
	t.Run("valid action with type", func(t *testing.T) {
		reply := "Here is your task:\n[[ACTION]]{\"type\":\"create_task\",\"title\":\"Review Workload\"}[[/ACTION]]"
		cleanReply, action := ExtractAction(reply)

		if cleanReply != "Here is your task:" {
			t.Errorf("expected clean reply 'Here is your task:', got %q", cleanReply)
		}
		if action == nil {
			t.Fatalf("expected action to be non-nil")
		}
		if action.Type != "create_task" {
			t.Errorf("expected action type 'create_task', got %q", action.Type)
		}
		if action.Title != "Review Workload" {
			t.Errorf("expected action title 'Review Workload', got %q", action.Title)
		}
	})

	t.Run("action missing type field", func(t *testing.T) {
		reply := "Here is a response:\n[[ACTION]]{\"title\":\"Missing Type Action\"}[[/ACTION]]"
		cleanReply, action := ExtractAction(reply)

		if cleanReply != "Here is a response:" {
			t.Errorf("expected clean reply 'Here is a response:', got %q", cleanReply)
		}
		if action != nil {
			t.Errorf("expected action to be nil when type is missing, got %+v", action)
		}
	})

	t.Run("action with null type field", func(t *testing.T) {
		reply := "Here is a response:\n[[ACTION]]{\"type\":null,\"title\":\"Null Type Action\"}[[/ACTION]]"
		_, action := ExtractAction(reply)

		if action != nil {
			t.Errorf("expected action to be nil when type is null, got %+v", action)
		}
	})

	t.Run("no action block", func(t *testing.T) {
		reply := "Just text without action"
		cleanReply, action := ExtractAction(reply)

		if cleanReply != reply {
			t.Errorf("expected clean reply %q, got %q", reply, cleanReply)
		}
		if action != nil {
			t.Errorf("expected action to be nil")
		}
	})
}
