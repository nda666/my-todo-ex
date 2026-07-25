package repository

import (
	"golang-todo/internal/libs/cache"
	"golang-todo/internal/libs/doranapi"

	"gorm.io/gorm"
)

type Repositories struct {
	Pegawai    PegawaiRepository
	Divisi     DivisiRepository
	DivisiIcon DivisiIconRepository
	Task       TaskRepository
	Meta       MetaRepository
	Comment    CommentRepository
	Reaction   ReactionRepository
	Profile    ProfileRepository
	Project    ProjectRepository
	Subtask    SubtaskRepository
}

func NewRepositories(db *gorm.DB, doranClient *doranapi.Client, c *cache.Cache) *Repositories {
	pegawaiRepo := NewPegawaiRepository(doranClient, c, db)
	return &Repositories{
		Pegawai:    pegawaiRepo,
		Divisi:     NewDivisiRepository(doranClient, c, pegawaiRepo),
		DivisiIcon: NewDivisiIconRepository(db),
		Task:       NewTaskRepository(db),
		Meta:       NewMetaRepository(db),
		Comment:    NewCommentRepository(db),
		Reaction:   NewReactionRepository(db),
		Profile:    NewProfileRepository(db),
		Project:    NewProjectRepository(db),
		Subtask:    NewSubtaskRepository(db),
	}
}
