package models

type MetaType string

const (
	MetaTypeText  MetaType = "TEXT"
	MetaTypeLink  MetaType = "LINK"
	MetaTypeColor MetaType = "COLOR"
	MetaTypeDate  MetaType = "DATE"
	MetaTypeFile  MetaType = "FILE"
	MetaTypeImage MetaType = "IMAGE"
)

type TaskMeta struct {
	ID        uint     `gorm:"primaryKey"`
	TaskID    uint     `gorm:"not null;index"`
	Key       string   `gorm:"size:100;not null"`
	Value     string   `gorm:"type:text"`
	Type      MetaType `gorm:"column:type;size:20;default:TEXT;not null"`
	SortOrder int      `gorm:"column:sort_order;default:0"`
}

func (TaskMeta) TableName() string {
	return "xv_task_meta"
}
