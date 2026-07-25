package database

import (
	"fmt"

	"golang-todo/internal/config"
	"golang-todo/internal/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Connect(cfg *config.Config) (*gorm.DB, error) {
	db, err := gorm.Open(mysql.Open(cfg.DSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("connect database: %w", err)
	}

	if err := AutoMigrateAll(db); err != nil {
		return nil, fmt.Errorf("auto migrate: %w", err)
	}

	return db, nil
}

func AutoMigrateAll(db *gorm.DB) error {
	tablesWithCharset := []interface{}{
		&models.Task{},
		&models.Subtask{},
		&models.TaskComment{},
		&models.TaskMeta{},
		&models.CommentReaction{},
		&models.CommentAttachment{},
		&models.Profile{},
		&models.DivisiIconCache{},

		&models.Project{},
		&models.ProjectDivision{},
		&models.ProjectLeader{},
		&models.ProjectTask{},
	}

	for _, m := range tablesWithCharset {
		if err := db.Set(
			"gorm:table_options",
			"ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci",
		).AutoMigrate(m); err != nil {
			return err
		}
	}
	return nil
}
