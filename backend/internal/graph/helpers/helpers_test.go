package helpers

import (
	"testing"
	"time"

	"golang-todo/internal/models"
)

func TestParseID(t *testing.T) {
	id, err := ParseID("123")
	if err != nil || id != 123 {
		t.Errorf("expected 123, got %d, err %v", id, err)
	}

	idInt, err := ParseID(456)
	if err != nil || idInt != 456 {
		t.Errorf("expected 456, got %d, err %v", idInt, err)
	}

	_, errInvalid := ParseID("abc")
	if errInvalid == nil {
		t.Error("expected error for invalid string id")
	}
}

func TestStrVal(t *testing.T) {
	if StrVal("hello") != "hello" {
		t.Error("expected hello")
	}
	if StrVal(nil) != "" {
		t.Error("expected empty string for nil")
	}
}

func TestDateParsingAndFormatting(t *testing.T) {
	parsed := ParseDatePtr("2026-07-25")
	if parsed == nil {
		t.Fatal("expected non-nil date pointer")
	}
	formatted := FormatDatePtr(parsed)
	if formatted != "2026-07-25" {
		t.Errorf("expected 2026-07-25, got %v", formatted)
	}

	if ParseDatePtr("") != nil {
		t.Error("expected nil for empty string date")
	}
	if FormatDatePtr(nil) != nil {
		t.Error("expected nil for nil date")
	}
}

func TestFormatTaskAndSubtask(t *testing.T) {
	now := time.Now()
	task := models.Task{
		ID:          1,
		Title:       "Test Task",
		Description: "Task description",
		Status:      models.TaskStatusPending,
		UserKode:    "U123",
		CreatedBy:   "U123",
		CreatedAt:   now,
		UpdatedAt:   now,
		Subtasks: []models.Subtask{
			{
				ID:          10,
				TaskID:      1,
				Description: "Subtask 1",
				Status:      models.SubtaskStatusPending,
				SortOrder:   1,
				CreatedAt:   now,
				UpdatedAt:   now,
			},
		},
	}

	formatted := FormatTask(task, "U123")
	if formatted["title"] != "Test Task" {
		t.Errorf("expected title Test Task, got %v", formatted["title"])
	}

	subtasks, ok := formatted["subtasks"].([]map[string]interface{})
	if !ok || len(subtasks) != 1 {
		t.Fatalf("expected 1 subtask, got %v", formatted["subtasks"])
	}
	if subtasks[0]["description"] != "Subtask 1" {
		t.Errorf("expected Subtask 1, got %v", subtasks[0]["description"])
	}
}
