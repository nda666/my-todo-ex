package models

import "time"

type CommentReaction struct {
	ID        uint      `gorm:"primaryKey"`
	CommentID uint      `gorm:"not null;index"`
	UserKode  string    `gorm:"column:user_kode;size:50;not null"`
	Emoji     string    `gorm:"size:10;not null;collate:utf8mb4_general_ci"`
	CreatedAt time.Time `gorm:"autoCreateTime"`
}

func (CommentReaction) TableName() string {
	return "xv_task_comment_reaction"
}
