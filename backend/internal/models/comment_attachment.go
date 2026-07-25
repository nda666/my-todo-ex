package models

import "time"

type CommentAttachment struct {
	ID        uint      `gorm:"primaryKey"`
	CommentID uint      `gorm:"not null;index"`
	URL       string    `gorm:"type:text;not null"`
	FileName  string    `gorm:"column:file_name;size:255;not null"`
	FileType  string    `gorm:"column:file_type;size:100"`
	SizeBytes int64     `gorm:"column:size_bytes;default:0"`
	CreatedAt time.Time `gorm:"autoCreateTime"`
}

func (CommentAttachment) TableName() string {
	return "xv_task_comment_attachment"
}
