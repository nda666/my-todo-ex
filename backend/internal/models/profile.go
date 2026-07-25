package models

import "time"

type Profile struct {
	Kodeku    string    `gorm:"column:kodeku;primaryKey"`
	AvatarURL string    `gorm:"column:avatar_url;type:text"`
	CreatedAt time.Time `gorm:"autoCreateTime"`
	UpdatedAt time.Time `gorm:"autoUpdateTime"`
}

func (Profile) TableName() string {
	return "xv_profile"
}
