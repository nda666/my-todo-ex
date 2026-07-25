package models

import (
	"testing"
)

func TestProjectTableNames(t *testing.T) {
	tests := []struct {
		name     string
		gotName  string
		wantName string
	}{
		{"Project table name", Project{}.TableName(), "xv_project"},
		{"ProjectDivision table name", ProjectDivision{}.TableName(), "xv_project_division"},
		{"ProjectLeader table name", ProjectLeader{}.TableName(), "xv_project_leader"},
		{"ProjectTask table name", ProjectTask{}.TableName(), "xv_project_task"},
		{"ProjectStageHistory table name", ProjectStageHistory{}.TableName(), "xv_project_stage_history"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.gotName != tt.wantName {
				t.Errorf("expected table name %q, got %q", tt.wantName, tt.gotName)
			}
		})
	}
}

func TestProjectStageConstants(t *testing.T) {
	if string(ProjectStagePlanning) != "PLANNING" {
		t.Errorf("expected ProjectStagePlanning 'PLANNING', got %s", ProjectStagePlanning)
	}
	if string(ProjectStageInProgress) != "IN_PROGRESS" {
		t.Errorf("expected ProjectStageInProgress 'IN_PROGRESS', got %s", ProjectStageInProgress)
	}
	if string(ProjectStageDone) != "DONE" {
		t.Errorf("expected ProjectStageDone 'DONE', got %s", ProjectStageDone)
	}
}
