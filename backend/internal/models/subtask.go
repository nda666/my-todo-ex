package models

import "time"

type SubtaskStatus string

const (
	SubtaskStatusPending   SubtaskStatus = "pending"
	SubtaskStatusCompleted SubtaskStatus = "completed"
)

type Subtask struct {
	ID          uint          `gorm:"primaryKey" json:"id"`
	TaskID      uint          `gorm:"column:task_id;not null;index" json:"task_id"`
	Description string        `gorm:"type:text;not null" json:"description"`
	Status      SubtaskStatus `gorm:"size:20;default:pending;not null" json:"status"`
	SortOrder   int           `gorm:"column:sort_order;default:0;index" json:"sort_order"`
	CreatedAt   time.Time     `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time     `gorm:"autoUpdateTime" json:"updated_at"`
}

func (Subtask) TableName() string {
	return "xv_subtask"
}
