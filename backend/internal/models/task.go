// backend/internal/models/task.go
package models

import "time"

type TaskStatus string

const (
	TaskStatusPending    TaskStatus = "pending"
	TaskStatusInProgress TaskStatus = "in_progress"
	TaskStatusCompleted  TaskStatus = "completed"
)

type Task struct {
	ID          uint          `gorm:"primaryKey"`
	Title       string        `gorm:"size:255;not null"`
	Description string        `gorm:"type:text"`
	Status      TaskStatus    `gorm:"size:20;default:pending;not null"`
	UserKode    string        `gorm:"column:user_kode;size:50;not null;index;collate:utf8mb4_general_ci"`
	CreatedBy   string        `gorm:"column:created_by;size:50;not null;index;collate:utf8mb4_general_ci"`
	SortOrder   int           `gorm:"column:sort_order;default:0;index"` // <-- baru, dipakai drag-and-drop
	StartDate   *time.Time    `gorm:"column:start_date"`
	DueDate     *time.Time    `gorm:"column:due_date"`
	CompletedAt *time.Time    `gorm:"column:completed_at"`
	CreatedAt   time.Time     `gorm:"autoCreateTime"`
	UpdatedAt   time.Time     `gorm:"autoUpdateTime"`
	Comments    []TaskComment `gorm:"foreignKey:TaskID"`
	Meta        []TaskMeta    `gorm:"foreignKey:TaskID"`
	Subtasks    []Subtask     `gorm:"foreignKey:TaskID"`
}

func (Task) TableName() string {
	return "xv_task"
}
