package repository

import (
	"context"
	"errors"
	"fmt"

	"golang-todo/internal/models"

	"gorm.io/gorm"
)

type ProjectRepository interface {
	Create(ctx context.Context, project *models.Project) error
	FindByID(ctx context.Context, id uint) (*models.Project, error)
	FindByDivisi(ctx context.Context, divisiKode int) ([]models.Project, error)
	AddDivision(ctx context.Context, projectID uint, divisiKode int, invitedBy string) error
	RemoveDivision(ctx context.Context, projectID uint, divisiKode int) error
	IsDivisionInProject(ctx context.Context, projectID uint, divisiKode int) (bool, error)
	AddLeader(ctx context.Context, projectID uint, pegawaiKode, addedBy string) error
	RemoveLeader(ctx context.Context, projectID uint, pegawaiKode string) error
	IsProjectLeader(ctx context.Context, projectID uint, pegawaiKode string) (bool, error)
	AttachTask(ctx context.Context, projectID uint, taskID uint) error
	ProjectIDForTask(ctx context.Context, taskID uint) (*uint, error)

	UpdateStage(ctx context.Context, projectID uint, toStage models.ProjectStage, note, changedBy string, expectedVersion int) (*models.Project, error)
	ReopenProject(ctx context.Context, projectID uint, expectedVersion int, changedBy string) (*models.Project, error)
	GetStageHistory(ctx context.Context, projectID uint) ([]models.ProjectStageHistory, error)
	GetDivisionProgress(ctx context.Context, projectID uint) ([]models.DivisionProgress, error)
	CountIncompleteTasks(ctx context.Context, projectID uint) (int64, error)
}

type projectRepository struct {
	db *gorm.DB
}

func NewProjectRepository(db *gorm.DB) ProjectRepository {
	return &projectRepository{db: db}
}

func (r *projectRepository) Create(ctx context.Context, project *models.Project) error {
	if project.Stage == "" {
		project.Stage = models.ProjectStagePlanning
	}
	if project.StageVersion == 0 {
		project.StageVersion = 1
	}
	return r.db.WithContext(ctx).Create(project).Error
}

func (r *projectRepository) FindByID(ctx context.Context, id uint) (*models.Project, error) {
	var p models.Project
	err := r.db.WithContext(ctx).
		Preload("Divisions").
		Preload("Leaders").
		Preload("StageHistory", func(db *gorm.DB) *gorm.DB {
			return db.Order("changed_at ASC")
		}).
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
		Preload("StageHistory", func(db *gorm.DB) *gorm.DB {
			return db.Order("changed_at ASC")
		}).
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

func isAllowedTransition(from, to models.ProjectStage) bool {
	if from == to {
		return true
	}
	switch from {
	case models.ProjectStagePlanning:
		return to == models.ProjectStageInProgress || to == models.ProjectStageOnHold || to == models.ProjectStageCancelled || to == models.ProjectStageRejected
	case models.ProjectStageInProgress:
		return to == models.ProjectStageReview || to == models.ProjectStageOnHold || to == models.ProjectStageCancelled || to == models.ProjectStageRejected
	case models.ProjectStageReview:
		return to == models.ProjectStageDone || to == models.ProjectStageRejected || to == models.ProjectStageOnHold || to == models.ProjectStageCancelled || to == models.ProjectStageInProgress
	case models.ProjectStageRejected:
		return to == models.ProjectStagePlanning || to == models.ProjectStageInProgress
	case models.ProjectStageOnHold:
		return to == models.ProjectStagePlanning || to == models.ProjectStageInProgress || to == models.ProjectStageReview
	default:
		return false
	}
}

func (r *projectRepository) UpdateStage(ctx context.Context, projectID uint, toStage models.ProjectStage, note, changedBy string, expectedVersion int) (*models.Project, error) {
	project, err := r.FindByID(ctx, projectID)
	if err != nil {
		return nil, err
	}

	if project.StageVersion != expectedVersion {
		return nil, errors.New("project sudah diubah oleh pengguna lain, silakan refresh halaman")
	}

	if !isAllowedTransition(project.Stage, toStage) {
		return nil, fmt.Errorf("transisi stage dari %s ke %s tidak diperbolehkan", project.Stage, toStage)
	}

	newStatus := models.ProjectStatusActive
	if toStage == models.ProjectStageDone {
		newStatus = models.ProjectStatusArchived
	}

	err = r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&models.Project{}).
			Where("id = ? AND stage_version = ?", projectID, expectedVersion).
			Updates(map[string]interface{}{
				"stage":         toStage,
				"status":        newStatus,
				"stage_version": gorm.Expr("stage_version + 1"),
			})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return errors.New("project sudah diubah oleh pengguna lain, silakan refresh halaman")
		}

		history := models.ProjectStageHistory{
			ProjectID: projectID,
			FromStage: project.Stage,
			ToStage:   toStage,
			ChangedBy: changedBy,
			Note:      note,
		}
		return tx.Create(&history).Error
	})
	if err != nil {
		return nil, err
	}

	return r.FindByID(ctx, projectID)
}

func (r *projectRepository) ReopenProject(ctx context.Context, projectID uint, expectedVersion int, changedBy string) (*models.Project, error) {
	project, err := r.FindByID(ctx, projectID)
	if err != nil {
		return nil, err
	}

	if project.Stage != models.ProjectStageDone && project.Stage != models.ProjectStageCancelled {
		return nil, errors.New("hanya project dengan stage DONE atau CANCELLED yang dapat di-reopen")
	}

	if project.StageVersion != expectedVersion {
		return nil, errors.New("project sudah diubah oleh pengguna lain, silakan refresh halaman")
	}

	err = r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&models.Project{}).
			Where("id = ? AND stage_version = ?", projectID, expectedVersion).
			Updates(map[string]interface{}{
				"stage":         models.ProjectStageInProgress,
				"status":        models.ProjectStatusActive,
				"stage_version": gorm.Expr("stage_version + 1"),
			})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return errors.New("project sudah diubah oleh pengguna lain, silakan refresh halaman")
		}

		history := models.ProjectStageHistory{
			ProjectID: projectID,
			FromStage: project.Stage,
			ToStage:   models.ProjectStageInProgress,
			ChangedBy: changedBy,
			Note:      "Project di-reopen ke stage IN_PROGRESS",
		}
		return tx.Create(&history).Error
	})
	if err != nil {
		return nil, err
	}

	return r.FindByID(ctx, projectID)
}

func (r *projectRepository) GetStageHistory(ctx context.Context, projectID uint) ([]models.ProjectStageHistory, error) {
	var histories []models.ProjectStageHistory
	err := r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("changed_at ASC").
		Find(&histories).Error
	return histories, err
}

func (r *projectRepository) CountIncompleteTasks(ctx context.Context, projectID uint) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Table("xv_project_task").
		Joins("JOIN xv_task ON xv_task.id = xv_project_task.task_id").
		Where("xv_project_task.project_id = ? AND xv_task.status != ?", projectID, models.TaskStatusCompleted).
		Count(&count).Error
	return count, err
}

func (r *projectRepository) GetDivisionProgress(ctx context.Context, projectID uint) ([]models.DivisionProgress, error) {
	project, err := r.FindByID(ctx, projectID)
	if err != nil {
		return nil, err
	}

	divisiMap := make(map[int]bool)
	divisiMap[project.OwnerDivisiKode] = true
	for _, pd := range project.Divisions {
		divisiMap[pd.DivisiKode] = true
	}

	var results []models.DivisionProgress
	for divisiKode := range divisiMap {
		var total int64
		var completed int64

		r.db.WithContext(ctx).
			Table("xv_project_task").
			Joins("JOIN xv_task ON xv_task.id = xv_project_task.task_id").
			Where("xv_project_task.project_id = ? AND (xv_task.divisi_kode = ? OR (xv_task.divisi_kode IS NULL AND xv_task.user_kode = ?))", projectID, divisiKode, fmt.Sprintf("%d", divisiKode)).
			Count(&total)

		r.db.WithContext(ctx).
			Table("xv_project_task").
			Joins("JOIN xv_task ON xv_task.id = xv_project_task.task_id").
			Where("xv_project_task.project_id = ? AND (xv_task.divisi_kode = ? OR (xv_task.divisi_kode IS NULL AND xv_task.user_kode = ?)) AND xv_task.status = ?", projectID, divisiKode, fmt.Sprintf("%d", divisiKode), models.TaskStatusCompleted).
			Count(&completed)

		percent := 0.0
		if total > 0 {
			percent = (float64(completed) / float64(total)) * 100.0
		}

		results = append(results, models.DivisionProgress{
			DivisiKode:     divisiKode,
			DivisiNama:     fmt.Sprintf("Divisi %d", divisiKode),
			TotalTasks:     int(total),
			CompletedTasks: int(completed),
			PercentDone:    percent,
		})
	}

	return results, nil
}
