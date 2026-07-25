package models

import "time"

type DivisiIconCache struct {
	KodeDivisi int       `gorm:"column:kodedivisi;primaryKey"`
	IconKey    string    `gorm:"column:icon_key;size:30;not null"`
	Color      string    `gorm:"column:color;size:10;not null"`
	UpdatedAt  time.Time `gorm:"autoUpdateTime"`
}

func (DivisiIconCache) TableName() string {
	return "xv_divisi_icon_cache"
}
