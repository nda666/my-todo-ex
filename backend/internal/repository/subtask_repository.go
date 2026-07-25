package repository

import (
	"context"
	"time"

	"golang-todo/internal/models"

	"gorm.io/gorm"
)

type SubtaskRepository interface {
	FindByTaskID(ctx context.Context, taskID uint) ([]models.Subtask, error)
	FindByID(ctx context.Context, id uint) (*models.Subtask, error)
	Create(ctx context.Context, subtask *models.Subtask) error
	Update(ctx context.Context, subtask *models.Subtask) error
	Delete(ctx context.Context, id uint) error
	Reorder(ctx context.Context, taskID uint, orderedIDs []uint) ([]models.Subtask, error)
	CheckAndUpdateParentTaskCompletion(ctx context.Context, taskID uint) (bool, error)
}

type subtaskRepository struct {
	db *gorm.DB
}

func NewSubtaskRepository(db *gorm.DB) SubtaskRepository {
	return &subtaskRepository{db: db}
}

func (r *subtaskRepository) FindByTaskID(ctx context.Context, taskID uint) ([]models.Subtask, error) {
	var subtasks []models.Subtask
	err := r.db.WithContext(ctx).
		Where("task_id = ?", taskID).
		Order("CASE WHEN status = 'pending' THEN 0 ELSE 1 END ASC, sort_order ASC, id ASC").
		Find(&subtasks).Error
	return subtasks, err
}

func (r *subtaskRepository) FindByID(ctx context.Context, id uint) (*models.Subtask, error) {
	var subtask models.Subtask
	err := r.db.WithContext(ctx).First(&subtask, id).Error
	if err != nil {
		return nil, err
	}
	return &subtask, nil
}

func (r *subtaskRepository) Create(ctx context.Context, subtask *models.Subtask) error {
	var maxSort int
	r.db.WithContext(ctx).Model(&models.Subtask{}).
		Where("task_id = ?", subtask.TaskID).
		Select("COALESCE(MAX(sort_order), 0)").
		Row().Scan(&maxSort)
	subtask.SortOrder = maxSort + 1
	return r.db.WithContext(ctx).Create(subtask).Error
}

func (r *subtaskRepository) Update(ctx context.Context, subtask *models.Subtask) error {
	return r.db.WithContext(ctx).Save(subtask).Error
}

func (r *subtaskRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.Subtask{}, id).Error
}

func (r *subtaskRepository) Reorder(ctx context.Context, taskID uint, orderedIDs []uint) ([]models.Subtask, error) {
	var updatedSubtasks []models.Subtask

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for i, id := range orderedIDs {
			order := i + 1
			err := tx.Model(&models.Subtask{}).
				Where("id = ? AND task_id = ?", id, taskID).
				Update("sort_order", order).Error
			if err != nil {
				return err
			}
		}

		return tx.Where("task_id = ?", taskID).
			Order("CASE WHEN status = 'pending' THEN 0 ELSE 1 END ASC, sort_order ASC, id ASC").
			Find(&updatedSubtasks).Error
	})

	if err != nil {
		return nil, err
	}
	return updatedSubtasks, nil
}

func (r *subtaskRepository) CheckAndUpdateParentTaskCompletion(ctx context.Context, taskID uint) (bool, error) {
	var totalCount int64
	var pendingCount int64

	if err := r.db.WithContext(ctx).Model(&models.Subtask{}).Where("task_id = ?", taskID).Count(&totalCount).Error; err != nil {
		return false, err
	}

	if totalCount == 0 {
		return false, nil
	}

	if err := r.db.WithContext(ctx).Model(&models.Subtask{}).Where("task_id = ? AND status != ?", taskID, models.SubtaskStatusCompleted).Count(&pendingCount).Error; err != nil {
		return false, err
	}

	var task models.Task
	if err := r.db.WithContext(ctx).First(&task, taskID).Error; err != nil {
		return false, err
	}

	if pendingCount == 0 {
		if task.Status != models.TaskStatusCompleted {
			now := time.Now()
			task.Status = models.TaskStatusCompleted
			task.CompletedAt = &now
			if err := r.db.WithContext(ctx).Save(&task).Error; err != nil {
				return false, err
			}
			return true, nil
		}
	} else {
		if task.Status == models.TaskStatusCompleted {
			task.Status = models.TaskStatusInProgress
			task.CompletedAt = nil
			if err := r.db.WithContext(ctx).Save(&task).Error; err != nil {
				return false, err
			}
			return true, nil
		}
	}

	return false, nil
}
