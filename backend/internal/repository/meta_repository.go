package repository

import (
	"context"
	"errors"

	"golang-todo/internal/models"

	"gorm.io/gorm"
)

type MetaRepository interface {
	Create(ctx context.Context, meta *models.TaskMeta) error
	Upsert(ctx context.Context, taskID uint, key string, value string, metaType models.MetaType) (*models.TaskMeta, error)
	Delete(ctx context.Context, id uint, kodeku string) (bool, error) // hanya boleh kalau task-nya milik/dibuat oleh kodeku
	DeleteAllForTask(ctx context.Context, taskID uint) error
	Reorder(ctx context.Context, taskID uint, orderedIDs []uint) error
}

type metaRepository struct {
	db *gorm.DB
}

func NewMetaRepository(db *gorm.DB) MetaRepository {
	return &metaRepository{db: db}
}

func (r *metaRepository) Create(ctx context.Context, meta *models.TaskMeta) error {
	return r.db.WithContext(ctx).Create(meta).Error
}

func (r *metaRepository) Upsert(ctx context.Context, taskID uint, key string, value string, metaType models.MetaType) (*models.TaskMeta, error) {
	var meta models.TaskMeta
	err := r.db.WithContext(ctx).Where("task_id = ? AND `key` = ?", taskID, key).First(&meta).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		meta = models.TaskMeta{TaskID: taskID, Key: key, Value: value, Type: metaType}
		if err := r.db.WithContext(ctx).Create(&meta).Error; err != nil {
			return nil, err
		}
		return &meta, nil
	} else if err != nil {
		return nil, err
	}

	meta.Value = value
	meta.Type = metaType
	if err := r.db.WithContext(ctx).Save(&meta).Error; err != nil {
		return nil, err
	}
	return &meta, nil
}

func (r *metaRepository) Delete(ctx context.Context, id uint, kodeku string) (bool, error) {
	var meta models.TaskMeta
	err := r.db.WithContext(ctx).
		Joins("JOIN xv_task ON xv_task.id = xv_task_meta.task_id").
		Where("xv_task_meta.id = ? AND (xv_task.user_kode = ? OR xv_task.created_by = ?)", id, kodeku, kodeku).
		First(&meta).Error
	if err != nil {
		return false, nil
	}
	result := r.db.WithContext(ctx).Delete(&meta)
	return result.RowsAffected > 0, result.Error
}

func (r *metaRepository) DeleteAllForTask(ctx context.Context, taskID uint) error {
	return r.db.WithContext(ctx).Where("task_id = ?", taskID).Delete(&models.TaskMeta{}).Error
}

func (r *metaRepository) Reorder(ctx context.Context, taskID uint, orderedIDs []uint) error {
	for i, id := range orderedIDs {
		if err := r.db.WithContext(ctx).Model(&models.TaskMeta{}).
			Where("id = ? AND task_id = ?", id, taskID).
			Update("sort_order", i).Error; err != nil {
			return err
		}
	}
	return nil
}
