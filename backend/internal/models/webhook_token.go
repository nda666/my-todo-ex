package models

import "time"

type WebhookToken struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	UserKode   string     `gorm:"column:user_kode;size:50;not null;index" json:"user_kode"`
	DivisiKode int        `gorm:"column:divisi_kode;not null" json:"divisi_kode"`
	Name       string     `gorm:"column:name;size:100;not null" json:"name"`
	Token      string     `gorm:"column:token;size:128;uniqueIndex;not null" json:"token"`
	CreatedAt  time.Time  `gorm:"autoCreateTime" json:"created_at"`
	LastUsedAt *time.Time `gorm:"column:last_used_at" json:"last_used_at"`
}

func (WebhookToken) TableName() string {
	return "xv_webhook_token"
}
