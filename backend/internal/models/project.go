package models

import "time"

type ProjectStatus string

const (
	ProjectStatusActive   ProjectStatus = "active"
	ProjectStatusArchived ProjectStatus = "archived"
)

type ProjectStage string

const (
	ProjectStagePlanning   ProjectStage = "PLANNING"
	ProjectStageInProgress ProjectStage = "IN_PROGRESS"
	ProjectStageReview     ProjectStage = "REVIEW"
	ProjectStageRejected   ProjectStage = "REJECTED"
	ProjectStageOnHold     ProjectStage = "ON_HOLD"
	ProjectStageCancelled  ProjectStage = "CANCELLED"
	ProjectStageDone       ProjectStage = "DONE"
)

type Project struct {
	ID              uint          `gorm:"primaryKey"`
	Name            string        `gorm:"size:255;not null"`
	Description     string        `gorm:"type:text"`
	OwnerDivisiKode int           `gorm:"column:owner_divisi_kode;not null;index"`
	Status          ProjectStatus `gorm:"size:20;default:active;not null"`
	Stage           ProjectStage  `gorm:"size:30;default:PLANNING;not null"`
	StageVersion    int           `gorm:"column:stage_version;default:1;not null"`
	CreatedBy       string        `gorm:"column:created_by;size:50;not null;collate:utf8mb4_general_ci"`
	CreatedAt       time.Time     `gorm:"autoCreateTime"`
	UpdatedAt       time.Time     `gorm:"autoUpdateTime"`

	Divisions    []ProjectDivision    `gorm:"foreignKey:ProjectID"`
	Leaders      []ProjectLeader      `gorm:"foreignKey:ProjectID"`
	Tasks        []ProjectTask        `gorm:"foreignKey:ProjectID"`
	StageHistory []ProjectStageHistory `gorm:"foreignKey:ProjectID"`
}

func (Project) TableName() string { return "xv_project" }

type ProjectDivision struct {
	ID         uint      `gorm:"primaryKey"`
	ProjectID  uint      `gorm:"not null;index"`
	DivisiKode int       `gorm:"column:divisi_kode;not null"`
	InvitedBy  string    `gorm:"column:invited_by;size:50;not null;collate:utf8mb4_general_ci"`
	JoinedAt   time.Time `gorm:"column:joined_at;autoCreateTime"`
}

func (ProjectDivision) TableName() string { return "xv_project_division" }

type ProjectLeader struct {
	ID          uint      `gorm:"primaryKey"`
	ProjectID   uint      `gorm:"not null;index"`
	PegawaiKode string    `gorm:"column:pegawai_kode;size:50;not null;collate:utf8mb4_general_ci"`
	AddedBy     string    `gorm:"column:added_by;size:50;not null;collate:utf8mb4_general_ci"`
	CreatedAt   time.Time `gorm:"autoCreateTime"`
}

func (ProjectLeader) TableName() string { return "xv_project_leader" }

type ProjectTask struct {
	ID        uint      `gorm:"primaryKey"`
	ProjectID uint      `gorm:"not null;index"`
	TaskID    uint      `gorm:"not null;uniqueIndex"`
	AddedAt   time.Time `gorm:"column:added_at;autoCreateTime"`
}

func (ProjectTask) TableName() string { return "xv_project_task" }

type ProjectStageHistory struct {
	ID        uint         `gorm:"primaryKey"`
	ProjectID uint         `gorm:"column:project_id;not null;index"`
	FromStage ProjectStage `gorm:"column:from_stage;size:30;not null"`
	ToStage   ProjectStage `gorm:"column:to_stage;size:30;not null"`
	ChangedBy string       `gorm:"column:changed_by;size:50;not null;collate:utf8mb4_general_ci"`
	ChangedAt time.Time    `gorm:"column:changed_at;autoCreateTime"`
	Note      string       `gorm:"column:note;type:text"`
}

func (ProjectStageHistory) TableName() string { return "xv_project_stage_history" }

type DivisionProgress struct {
	DivisiKode     int     `json:"divisiKode"`
	DivisiNama     string  `json:"divisiNama"`
	TotalTasks     int     `json:"totalTasks"`
	CompletedTasks int     `json:"completedTasks"`
	PercentDone    float64 `json:"percentDone"`
}
