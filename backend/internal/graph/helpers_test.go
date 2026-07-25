package graph

import (
	"testing"
	"time"

	"golang-todo/internal/models"
)

func TestParseID(t *testing.T) {
	tests := []struct {
		name      string
		input     interface{}
		wantID    uint
		expectErr bool
	}{
		{"valid string id", "123", 123, false},
		{"valid zero string id", "0", 0, false},
		{"valid integer id", 456, 456, false},
		{"invalid string id", "abc", 0, true},
		{"invalid float id", 12.34, 0, true},
		{"nil input", nil, 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseID(tt.input)
			if (err != nil) != tt.expectErr {
				t.Fatalf("parseID() error = %v, expectErr %v", err, tt.expectErr)
			}
			if got != tt.wantID {
				t.Errorf("parseID() = %v, want %v", got, tt.wantID)
			}
		})
	}
}

func TestStrVal(t *testing.T) {
	if got := strVal(nil); got != "" {
		t.Errorf("strVal(nil) = %q, want empty string", got)
	}
	if got := strVal("hello"); got != "hello" {
		t.Errorf("strVal(\"hello\") = %q, want \"hello\"", got)
	}
}

func TestFormatSubtask(t *testing.T) {
	now := time.Now()
	st := models.Subtask{
		ID:          10,
		TaskID:      100,
		Description: "Check requirements",
		Status:      "PENDING",
		SortOrder:   1,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	res := formatSubtask(st)
	if res["id"] != "10" {
		t.Errorf("expected id '10', got %v", res["id"])
	}
	if res["taskId"] != "100" {
		t.Errorf("expected taskId '100', got %v", res["taskId"])
	}
	if res["description"] != "Check requirements" {
		t.Errorf("expected description 'Check requirements', got %v", res["description"])
	}
	if res["status"] != "PENDING" {
		t.Errorf("expected status 'PENDING', got %v", res["status"])
	}
}

func TestFormatTask(t *testing.T) {
	now := time.Now()
	task := models.Task{
		ID:          50,
		Title:       "Backend Refactoring",
		Description: "Clean architecture implementation",
		Status:      "IN_PROGRESS",
		UserKode:    "PEG-101",
		CreatedBy:   "PEG-100",
		CreatedAt:   now,
		UpdatedAt:   now,
		SortOrder:   2,
		Subtasks: []models.Subtask{
			{
				ID:          1,
				TaskID:      50,
				Description: "Write unit tests",
				Status:      "COMPLETED",
			},
		},
	}

	formatted := formatTask(task, "PEG-101")
	if formatted["id"] != "50" {
		t.Errorf("expected id '50', got %v", formatted["id"])
	}
	if formatted["title"] != "Backend Refactoring" {
		t.Errorf("expected title 'Backend Refactoring', got %v", formatted["title"])
	}
	if formatted["status"] != "IN_PROGRESS" {
		t.Errorf("expected status 'IN_PROGRESS', got %v", formatted["status"])
	}

	subtasks, ok := formatted["subtasks"].([]map[string]interface{})
	if !ok || len(subtasks) != 1 {
		t.Fatalf("expected 1 subtask, got %v", formatted["subtasks"])
	}
	if subtasks[0]["description"] != "Write unit tests" {
		t.Errorf("expected subtask description 'Write unit tests', got %v", subtasks[0]["description"])
	}
}
