package auth

import (
	"context"

	"golang-todo/internal/repository"
)

type ActorContext struct {
	Kodeku           string
	DivisiKode       int
	IsDivisionLeader bool // status leader divisi (dari xv_leader_override + API pegawai)
}

type ProjectPolicy struct {
	projects repository.ProjectRepository
	pegawai  repository.PegawaiRepository
}

func NewProjectPolicy(projects repository.ProjectRepository, pegawai repository.PegawaiRepository) *ProjectPolicy {
	return &ProjectPolicy{projects: projects, pegawai: pegawai}
}

// CanCreateProject: hanya leader divisi yang boleh membuat project baru.
func (p *ProjectPolicy) CanCreateProject(actor ActorContext) bool {
	return actor.IsDivisionLeader
}

// CanInviteDivision: hanya project leader ATAU leader divisi pemilik yang boleh invite divisi lain.
func (p *ProjectPolicy) CanInviteDivision(ctx context.Context, actor ActorContext, projectID uint) (bool, error) {
	project, err := p.projects.FindByID(ctx, projectID)
	if err != nil {
		return false, err
	}
	if project.OwnerDivisiKode == actor.DivisiKode && actor.IsDivisionLeader {
		return true, nil
	}
	isLeader, err := p.projects.IsProjectLeader(ctx, projectID, actor.Kodeku)
	if err != nil {
		return false, err
	}
	return isLeader, nil
}

// CanRemoveDivision: sama seperti invite, tapi divisi pemilik tidak bisa dikeluarkan (dicek di repo).
func (p *ProjectPolicy) CanRemoveDivision(ctx context.Context, actor ActorContext, projectID uint) (bool, error) {
	return p.CanInviteDivision(ctx, actor, projectID) // aturan otorisasinya sama
}

// CanManageProjectLeaders: hanya existing project leader yang boleh tambah/hapus project leader lain.
func (p *ProjectPolicy) CanManageProjectLeaders(ctx context.Context, actor ActorContext, projectID uint) (bool, error) {
	return p.projects.IsProjectLeader(ctx, projectID, actor.Kodeku)
}

// CanCreateTaskInProject: leader divisi anggota, project leader, ATAU pegawai biasa dari divisi anggota.
func (p *ProjectPolicy) CanCreateTaskInProject(ctx context.Context, actor ActorContext, projectID uint) (bool, error) {
	inProject, err := p.projects.IsDivisionInProject(ctx, projectID, actor.DivisiKode)
	if err != nil || !inProject {
		return false, err
	}
	return true, nil // semua anggota divisi yang tergabung boleh create task (poin 5 requirement)
}

// CanAssignTaskTo: menentukan siapa yang boleh assign task ke pegawaiKode target di dalam project.
// actor boleh assign kalau: dia project leader, ATAU dia leader divisi dan target ada di divisi yang tergabung project.
func (p *ProjectPolicy) CanAssignTaskTo(ctx context.Context, actor ActorContext, projectID uint, targetDivisiKode int) (bool, error) {
	isProjectLeader, err := p.projects.IsProjectLeader(ctx, projectID, actor.Kodeku)
	if err != nil {
		return false, err
	}
	if isProjectLeader {
		// project leader boleh assign ke siapapun anggota project, apapun divisinya
		return p.projects.IsDivisionInProject(ctx, projectID, targetDivisiKode)
	}
	if actor.IsDivisionLeader {
		// leader divisi hanya boleh assign dalam lingkup divisi anggota project (termasuk divisi lain yg tergabung,
		// karena requirement poin 6 bilang "Leader Divisi juga dapat memindahkan Task kepada anggota mana pun yang
		// berada dalam Project" - bukan cuma divisinya sendiri)
		inProject, err := p.projects.IsDivisionInProject(ctx, projectID, actor.DivisiKode)
		if err != nil || !inProject {
			return false, err
		}
		return p.projects.IsDivisionInProject(ctx, projectID, targetDivisiKode)
	}
	return false, nil
}

// CanViewProjectFully: project leader melihat semua task; leader divisi melihat task divisinya saja;
// pegawai biasa mengikuti aturan visibility task normal (task sendiri + task tim divisi, existing rule).
func (p *ProjectPolicy) CanViewProjectFully(ctx context.Context, actor ActorContext, projectID uint) (bool, error) {
	return p.projects.IsProjectLeader(ctx, projectID, actor.Kodeku)
}
