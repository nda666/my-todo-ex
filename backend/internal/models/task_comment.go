package models

import "time"

type TaskComment struct {
	ID          uint                `gorm:"primaryKey"`
	TaskID      uint                `gorm:"not null;index"`
	UserKode    string              `gorm:"column:user_kode;size:50;not null"`
	Content     string              `gorm:"type:text;not null"`
	ParentID    *uint               `gorm:"column:parent_id"`
	CreatedAt   time.Time           `gorm:"autoCreateTime"`
	Replies     []TaskComment       `gorm:"foreignKey:ParentID"`
	Reactions   []CommentReaction   `gorm:"foreignKey:CommentID"`
	Attachments []CommentAttachment `gorm:"foreignKey:CommentID"`
}

func (TaskComment) TableName() string {
	return "xv_task_comment"
}
