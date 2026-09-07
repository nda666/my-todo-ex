package database

import (
	"fmt"
	"log"
	"os"
	"time"

	"golang-todo/internal/config"
	"golang-todo/internal/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Connect(cfg *config.Config) (*gorm.DB, error) {
	customLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             2 * time.Second,
			LogLevel:                  logger.Warn,
			IgnoreRecordNotFoundError: true,
			Colorful:                  false,
		},
	)

	db, err := gorm.Open(mysql.Open(cfg.DSN()), &gorm.Config{
		Logger: customLogger,
	})
	if err != nil {
		return nil, fmt.Errorf("connect database: %w", err)
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
		&models.ProjectStageHistory{},
		&models.ProjectWorkflowStep{},
		&models.WebhookToken{},
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
