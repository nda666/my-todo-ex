package repository

import (
	"context"

	"golang-todo/internal/models"

	"gorm.io/gorm"
)

type CommentRepository interface {
	Create(ctx context.Context, comment *models.TaskComment) error
	CreateAttachment(ctx context.Context, attachment *models.CommentAttachment) error
	FindByID(ctx context.Context, id uint) (*models.TaskComment, error)
}

type commentRepository struct {
	db *gorm.DB
}

func NewCommentRepository(db *gorm.DB) CommentRepository {
	return &commentRepository{db: db}
}

func (r *commentRepository) Create(ctx context.Context, comment *models.TaskComment) error {
	return r.db.WithContext(ctx).Create(comment).Error
}

func (r *commentRepository) CreateAttachment(ctx context.Context, attachment *models.CommentAttachment) error {
	return r.db.WithContext(ctx).Create(attachment).Error
}

func (r *commentRepository) FindByID(ctx context.Context, id uint) (*models.TaskComment, error) {
	var comment models.TaskComment
	err := r.db.WithContext(ctx).
		Preload("Replies").
		Preload("Replies.Reactions").
		Preload("Replies.Attachments").
		Preload("Reactions").
		Preload("Attachments").
		First(&comment, id).Error
	if err != nil {
		return nil, err
	}
	return &comment, nil
}
