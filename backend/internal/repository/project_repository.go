package repository

import (
	"context"
	"errors"

	"golang-todo/internal/models"

	"gorm.io/gorm"
)

type ProjectRepository interface {
	Create(ctx context.Context, project *models.Project) error
	FindByID(ctx context.Context, id uint) (*models.Project, error)
	FindByDivisi(ctx context.Context, divisiKode int) ([]models.Project, error) // project yang divisi ini ikut (owner ATAU invited)
	AddDivision(ctx context.Context, projectID uint, divisiKode int, invitedBy string) error
	RemoveDivision(ctx context.Context, projectID uint, divisiKode int) error
	IsDivisionInProject(ctx context.Context, projectID uint, divisiKode int) (bool, error)
	AddLeader(ctx context.Context, projectID uint, pegawaiKode, addedBy string) error
	RemoveLeader(ctx context.Context, projectID uint, pegawaiKode string) error
	IsProjectLeader(ctx context.Context, projectID uint, pegawaiKode string) (bool, error)
	AttachTask(ctx context.Context, projectID uint, taskID uint) error
	ProjectIDForTask(ctx context.Context, taskID uint) (*uint, error)
}

type projectRepository struct {
	db *gorm.DB
}

func NewProjectRepository(db *gorm.DB) ProjectRepository {
	return &projectRepository{db: db}
}

func (r *projectRepository) Create(ctx context.Context, project *models.Project) error {
	return r.db.WithContext(ctx).Create(project).Error
}

func (r *projectRepository) FindByID(ctx context.Context, id uint) (*models.Project, error) {
	var p models.Project
	err := r.db.WithContext(ctx).
		Preload("Divisions").
		Preload("Leaders").
		First(&p, id).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *projectRepository) FindByDivisi(ctx context.Context, divisiKode int) ([]models.Project, error) {
	var projects []models.Project
	err := r.db.WithContext(ctx).
		Distinct("xv_project.*").
		Joins("LEFT JOIN xv_project_division pd ON pd.project_id = xv_project.id").
		Where("xv_project.owner_divisi_kode = ? OR pd.divisi_kode = ?", divisiKode, divisiKode).
		Preload("Divisions").
		Preload("Leaders").
		Find(&projects).Error
	return projects, err
}

func (r *projectRepository) AddDivision(ctx context.Context, projectID uint, divisiKode int, invitedBy string) error {
	var existing models.ProjectDivision
	err := r.db.WithContext(ctx).Where("project_id = ? AND divisi_kode = ?", projectID, divisiKode).First(&existing).Error
	if err == nil {
		return errors.New("divisi sudah tergabung dalam project ini")
	}
	return r.db.WithContext(ctx).Create(&models.ProjectDivision{
		ProjectID: projectID, DivisiKode: divisiKode, InvitedBy: invitedBy,
	}).Error
}

func (r *projectRepository) RemoveDivision(ctx context.Context, projectID uint, divisiKode int) error {
	var project models.Project
	if err := r.db.WithContext(ctx).First(&project, projectID).Error; err != nil {
		return err
	}
	if project.OwnerDivisiKode == divisiKode {
		return errors.New("divisi pemilik project tidak bisa dikeluarkan")
	}
	return r.db.WithContext(ctx).
		Where("project_id = ? AND divisi_kode = ?", projectID, divisiKode).
		Delete(&models.ProjectDivision{}).Error
}

func (r *projectRepository) IsDivisionInProject(ctx context.Context, projectID uint, divisiKode int) (bool, error) {
	var project models.Project
	if err := r.db.WithContext(ctx).First(&project, projectID).Error; err != nil {
		return false, err
	}
	if project.OwnerDivisiKode == divisiKode {
		return true, nil
	}
	var count int64
	err := r.db.WithContext(ctx).Model(&models.ProjectDivision{}).
		Where("project_id = ? AND divisi_kode = ?", projectID, divisiKode).Count(&count).Error
	return count > 0, err
}

func (r *projectRepository) AddLeader(ctx context.Context, projectID uint, pegawaiKode, addedBy string) error {
	var existing models.ProjectLeader
	err := r.db.WithContext(ctx).Where("project_id = ? AND pegawai_kode = ?", projectID, pegawaiKode).First(&existing).Error
	if err == nil {
		return errors.New("pegawai sudah menjadi project leader")
	}
	return r.db.WithContext(ctx).Create(&models.ProjectLeader{
		ProjectID: projectID, PegawaiKode: pegawaiKode, AddedBy: addedBy,
	}).Error
}

func (r *projectRepository) RemoveLeader(ctx context.Context, projectID uint, pegawaiKode string) error {
	var count int64
	r.db.WithContext(ctx).Model(&models.ProjectLeader{}).Where("project_id = ?", projectID).Count(&count)
	if count <= 1 {
		return errors.New("project harus memiliki minimal satu project leader")
	}
	return r.db.WithContext(ctx).
		Where("project_id = ? AND pegawai_kode = ?", projectID, pegawaiKode).
		Delete(&models.ProjectLeader{}).Error
}

func (r *projectRepository) IsProjectLeader(ctx context.Context, projectID uint, pegawaiKode string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.ProjectLeader{}).
		Where("project_id = ? AND pegawai_kode = ?", projectID, pegawaiKode).Count(&count).Error
	return count > 0, err
}

func (r *projectRepository) AttachTask(ctx context.Context, projectID uint, taskID uint) error {
	// unique index di task_id otomatis cegah task punya >1 project - error dari DB
	// akan bubble up di sini kalau task sudah terpasang ke project lain.
	return r.db.WithContext(ctx).Create(&models.ProjectTask{
		ProjectID: projectID, TaskID: taskID,
	}).Error
}

func (r *projectRepository) ProjectIDForTask(ctx context.Context, taskID uint) (*uint, error) {
	var pt models.ProjectTask
	err := r.db.WithContext(ctx).Where("task_id = ?", taskID).First(&pt).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &pt.ProjectID, nil
}
