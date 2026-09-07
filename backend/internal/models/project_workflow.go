package models

import "time"

type WorkflowStepStatus string

const (
	WorkflowStepStatusPending    WorkflowStepStatus = "PENDING"
	WorkflowStepStatusInProgress WorkflowStepStatus = "IN_PROGRESS"
	WorkflowStepStatusCompleted  WorkflowStepStatus = "COMPLETED"
)

type ProjectWorkflowStep struct {
	ID          uint               `gorm:"primaryKey" json:"id"`
	ProjectID   uint               `gorm:"column:project_id;not null;index" json:"projectId"`
	ParentID    *uint              `gorm:"column:parent_id;index" json:"parentId"`
	Title       string             `gorm:"size:255;not null" json:"title"`
	Description string             `gorm:"type:text" json:"description"`
	DivisiKode  *int               `gorm:"column:divisi_kode" json:"divisiKode"`
	Status      WorkflowStepStatus `gorm:"size:30;default:PENDING;not null" json:"status"`
	SortOrder   int                `gorm:"column:sort_order;default:0;not null" json:"sortOrder"`
	CreatedBy   string             `gorm:"column:created_by;size:50;not null;collate:utf8mb4_general_ci" json:"createdBy"`
	CreatedAt   time.Time          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time          `gorm:"autoUpdateTime" json:"updatedAt"`

	Children []ProjectWorkflowStep `gorm:"foreignKey:ParentID" json:"children"`
}

func (ProjectWorkflowStep) TableName() string { return "xv_project_workflow_step" }
