package repository

import (
	"context"
	"errors"

	"golang-todo/internal/libs/imagesearch"
	"golang-todo/internal/models"

	"gorm.io/gorm"
)

type DivisiIconRepository interface {
	GetOrCompute(ctx context.Context, kodeDivisi int, nama string) (iconKey string, color string, err error)
}

type divisiIconRepository struct {
	db *gorm.DB
}

func NewDivisiIconRepository(db *gorm.DB) DivisiIconRepository {
	return &divisiIconRepository{db: db}
}

func (r *divisiIconRepository) GetOrCompute(ctx context.Context, kodeDivisi int, nama string) (string, string, error) {
	var cached models.DivisiIconCache
	err := r.db.WithContext(ctx).Where("kodedivisi = ?", kodeDivisi).First(&cached).Error
	if err == nil {
		return cached.IconKey, cached.Color, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", "", err
	}

	icon := imagesearch.GetDivisionIcon(nama)
	entry := models.DivisiIconCache{
		KodeDivisi: kodeDivisi,
		IconKey:    icon.IconKey,
		Color:      icon.Color,
	}
	if err := r.db.WithContext(ctx).Create(&entry).Error; err != nil {
		return "", "", err
	}

	return icon.IconKey, icon.Color, nil
}
