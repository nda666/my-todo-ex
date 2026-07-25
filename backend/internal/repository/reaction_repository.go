package repository

import (
	"context"

	"golang-todo/internal/models"

	"gorm.io/gorm"
)

type ReactionRepository interface {
	Toggle(ctx context.Context, commentID uint, kodeku string, emoji string) error
}

type reactionRepository struct {
	db *gorm.DB
}

func NewReactionRepository(db *gorm.DB) ReactionRepository {
	return &reactionRepository{db: db}
}

// Toggle enforce satu reaction aktif per user per komentar.
// - Kalau user klik emoji yang sama dengan reaction aktifnya sekarang -> hapus (un-react).
// - Kalau user klik emoji berbeda -> hapus reaction lama, pasang yang baru (atomic, dalam satu transaksi).
func (r *reactionRepository) Toggle(ctx context.Context, commentID uint, kodeku string, emoji string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing models.CommentReaction
		err := tx.Where("comment_id = ? AND user_kode = ?", commentID, kodeku).First(&existing).Error

		switch {
		case err == nil && existing.Emoji == emoji:
			// klik emoji yang sama -> un-react
			return tx.Delete(&existing).Error

		case err == nil:
			// klik emoji berbeda -> ganti
			if delErr := tx.Delete(&existing).Error; delErr != nil {
				return delErr
			}
			return tx.Create(&models.CommentReaction{
				CommentID: commentID,
				UserKode:  kodeku,
				Emoji:     emoji,
			}).Error

		case gorm.ErrRecordNotFound == err:
			// belum ada reaction sama sekali -> pasang baru
			return tx.Create(&models.CommentReaction{
				CommentID: commentID,
				UserKode:  kodeku,
				Emoji:     emoji,
			}).Error

		default:
			return err
		}
	})
}
