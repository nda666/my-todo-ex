package repository

import (
	"context"
	"errors"

	"golang-todo/internal/models"

	"gorm.io/gorm"
)

type ProfileRepository interface {
	UpsertAvatar(ctx context.Context, kodeku string, avatarURL string) error
	GetAvatar(ctx context.Context, kodeku string) (string, bool, error)
}

type profileRepository struct {
	db *gorm.DB
}

func NewProfileRepository(db *gorm.DB) ProfileRepository {
	return &profileRepository{db: db}
}

func (r *profileRepository) UpsertAvatar(ctx context.Context, kodeku string, avatarURL string) error {
	var profile models.Profile
	err := r.db.WithContext(ctx).Where("kodeku = ?", kodeku).First(&profile).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return r.db.WithContext(ctx).Create(&models.Profile{Kodeku: kodeku, AvatarURL: avatarURL}).Error
	} else if err != nil {
		return err
	}
	profile.AvatarURL = avatarURL
	return r.db.WithContext(ctx).Save(&profile).Error
}

func (r *profileRepository) GetAvatar(ctx context.Context, kodeku string) (string, bool, error) {
	var profile models.Profile
	err := r.db.WithContext(ctx).Where("kodeku = ?", kodeku).First(&profile).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return profile.AvatarURL, true, nil
}
