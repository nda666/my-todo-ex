package auth

import (
	"context"
	"errors"
	"testing"

	"golang-todo/internal/models"
	"golang-todo/internal/repository"
)

// mockProjectRepo implements repository.ProjectRepository for isolation tests
type mockProjectRepo struct {
	repository.ProjectRepository
	projects              map[uint]*models.Project
	projectLeaders        map[string]bool // "projectID:pegawaiKode"
	divisionsInProject    map[string]bool // "projectID:divisiKode"
}

func newMockProjectRepo() *mockProjectRepo {
	return &mockProjectRepo{
		projects:           make(map[uint]*models.Project),
		projectLeaders:     make(map[string]bool),
		divisionsInProject: make(map[string]bool),
	}
}

func (m *mockProjectRepo) FindByID(ctx context.Context, id uint) (*models.Project, error) {
	p, ok := m.projects[id]
	if !ok {
		return nil, errors.New("project not found")
	}
	return p, nil
}

func (m *mockProjectRepo) IsProjectLeader(ctx context.Context, projectID uint, pegawaiKode string) (bool, error) {
	key := string(rune(projectID)) + ":" + pegawaiKode
	return m.projectLeaders[key], nil
}

func (m *mockProjectRepo) IsDivisionInProject(ctx context.Context, projectID uint, divisiKode int) (bool, error) {
	key := string(rune(projectID)) + ":" + string(rune(divisiKode))
	return m.divisionsInProject[key], nil
}

func TestProjectPolicy(t *testing.T) {
	mockRepo := newMockProjectRepo()
	policy := NewProjectPolicy(mockRepo, nil)

	// Setup mock data
	mockRepo.projects[1] = &models.Project{
		ID:               1,
		Title:            "Project Alpha",
		OwnerDivisiKode: 10,
	}
	// Project Leader for project 1: PEG-999
	mockRepo.projectLeaders[string(rune(1))+":PEG-999"] = true

	// Division 10 & Division 20 are in Project 1
	mockRepo.divisionsInProject[string(rune(1))+":"+string(rune(10))] = true
	mockRepo.divisionsInProject[string(rune(1))+":"+string(rune(20))] = true

	ctx := context.Background()

	t.Run("CanCreateProject", func(t *testing.T) {
		leaderActor := ActorContext{Kodeku: "PEG-1", DivisiKode: 10, IsDivisionLeader: true}
		memberActor := ActorContext{Kodeku: "PEG-2", DivisiKode: 10, IsDivisionLeader: false}

		if !policy.CanCreateProject(leaderActor) {
			t.Error("expected division leader to be allowed to create project")
		}
		if policy.CanCreateProject(memberActor) {
			t.Error("expected non-leader member to be forbidden from creating project")
		}
	})

	t.Run("CanInviteDivision", func(t *testing.T) {
		ownerLeader := ActorContext{Kodeku: "PEG-10", DivisiKode: 10, IsDivisionLeader: true}
		projectLeader := ActorContext{Kodeku: "PEG-999", DivisiKode: 30, IsDivisionLeader: false}
		regularMember := ActorContext{Kodeku: "PEG-30", DivisiKode: 20, IsDivisionLeader: false}

		// Owner Division Leader -> Allowed
		allowed, err := policy.CanInviteDivision(ctx, ownerLeader, 1)
		if err != nil || !allowed {
			t.Errorf("expected owner leader allowed, got allowed=%v, err=%v", allowed, err)
		}

		// Project Leader -> Allowed
		allowed, err = policy.CanInviteDivision(ctx, projectLeader, 1)
		if err != nil || !allowed {
			t.Errorf("expected project leader allowed, got allowed=%v, err=%v", allowed, err)
		}

		// Regular Member -> Forbidden
		allowed, err = policy.CanInviteDivision(ctx, regularMember, 1)
		if err != nil || allowed {
			t.Errorf("expected regular member forbidden, got allowed=%v", allowed)
		}
	})

	t.Run("CanCreateTaskInProject", func(t *testing.T) {
		memberInProject := ActorContext{Kodeku: "PEG-20", DivisiKode: 20}
		memberOutsideProject := ActorContext{Kodeku: "PEG-50", DivisiKode: 50}

		canCreate, err := policy.CanCreateTaskInProject(ctx, memberInProject, 1)
		if err != nil || !canCreate {
			t.Errorf("expected member in project division to be allowed, got %v", canCreate)
		}

		canCreate, err = policy.CanCreateTaskInProject(ctx, memberOutsideProject, 1)
		if err != nil || canCreate {
			t.Errorf("expected member outside project to be forbidden, got %v", canCreate)
		}
	})

	t.Run("CanAssignTaskTo", func(t *testing.T) {
		projLeader := ActorContext{Kodeku: "PEG-999", DivisiKode: 30, IsDivisionLeader: false}
		divLeader := ActorContext{Kodeku: "PEG-10", DivisiKode: 10, IsDivisionLeader: true}
		regularMember := ActorContext{Kodeku: "PEG-20", DivisiKode: 20, IsDivisionLeader: false}

		// Proj leader can assign task to target division in project (Div 20)
		canAssign, err := policy.CanAssignTaskTo(ctx, projLeader, 1, 20)
		if err != nil || !canAssign {
			t.Errorf("expected project leader able to assign to project division, got %v", canAssign)
		}

		// Proj leader cannot assign to division outside project (Div 99)
		canAssign, err = policy.CanAssignTaskTo(ctx, projLeader, 1, 99)
		if err != nil || canAssign {
			t.Errorf("expected project leader unable to assign to non-project division, got %v", canAssign)
		}

		// Division leader can assign to division in project
		canAssign, err = policy.CanAssignTaskTo(ctx, divLeader, 1, 20)
		if err != nil || !canAssign {
			t.Errorf("expected division leader able to assign task in project, got %v", canAssign)
		}

		// Regular member cannot assign tasks
		canAssign, err = policy.CanAssignTaskTo(ctx, regularMember, 1, 20)
		if err != nil || canAssign {
			t.Errorf("expected regular member unable to assign tasks, got %v", canAssign)
		}
	})
}
