package repository

import (
	"context"

	"golang-todo/internal/models"

	"gorm.io/gorm"
)

type UserRepository interface {
	FindByKodeku(ctx context.Context, kodeku string) (*models.MasterUser, error)
}

type userRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) UserRepository {
	return &userRepository{db: db}
}

func (r *userRepository) FindByKodeku(ctx context.Context, kodeku string) (*models.MasterUser, error) {
	var user models.MasterUser
	err := r.db.WithContext(ctx).
		Preload("Pegawai.Jabatan").
		Preload("Pegawai.Divisi").
		Preload("Profile").
		Where("kodeku = ?", kodeku).
		First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}
