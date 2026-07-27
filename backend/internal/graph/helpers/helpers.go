package helpers

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"golang-todo/internal/auth"
	"golang-todo/internal/models"
	"golang-todo/internal/repository"
)

func ParseID(v interface{}) (uint, error) {
	switch id := v.(type) {
	case string:
		n, err := strconv.ParseUint(id, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid id")
		}
		return uint(n), nil
	case int:
		return uint(id), nil
	default:
		return 0, fmt.Errorf("invalid id")
	}
}

func StrVal(v interface{}) string {
	if v == nil {
		return ""
	}
	return v.(string)
}

func FormatTime(t time.Time) string {
	return t.Format(time.RFC3339)
}

func FormatSubtask(s models.Subtask) map[string]interface{} {
	return map[string]interface{}{
		"id":          strconv.FormatUint(uint64(s.ID), 10),
		"taskId":      strconv.FormatUint(uint64(s.TaskID), 10),
		"description": s.Description,
		"status":      s.Status,
		"sortOrder":   s.SortOrder,
		"createdAt":   FormatTime(s.CreatedAt),
		"updatedAt":   FormatTime(s.UpdatedAt),
	}
}

func FormatTask(task models.Task, currentUserKode string) map[string]interface{} {
	comments := make([]map[string]interface{}, 0)
	for _, c := range task.Comments {
		if c.ParentID == nil {
			comments = append(comments, FormatComment(c, currentUserKode))
		}
	}
	meta := make([]map[string]interface{}, len(task.Meta))
	for i, m := range task.Meta {
		meta[i] = FormatMeta(m)
	}
	subtasks := make([]map[string]interface{}, len(task.Subtasks))
	for i, s := range task.Subtasks {
		subtasks[i] = FormatSubtask(s)
	}
	return map[string]interface{}{
		"id":          strconv.FormatUint(uint64(task.ID), 10),
		"title":       task.Title,
		"description": task.Description,
		"status":      task.Status,
		"userKode":    task.UserKode,
		"createdBy":   task.CreatedBy,
		"startDate":   FormatDatePtr(task.StartDate),
		"dueDate":     FormatDatePtr(task.DueDate),
		"completedAt": FormatDatePtr(task.CompletedAt),
		"createdAt":   FormatTime(task.CreatedAt),
		"updatedAt":   FormatTime(task.UpdatedAt),
		"sortOrder":   task.SortOrder,
		"comments":    comments,
		"meta":        meta,
		"subtasks":    subtasks,
	}
}

func FormatTasks(tasks []models.Task, currentUserKode string) []map[string]interface{} {
	result := make([]map[string]interface{}, len(tasks))
	for i, t := range tasks {
		result[i] = FormatTask(t, currentUserKode)
	}
	return result
}

func FormatMeta(m models.TaskMeta) map[string]interface{} {
	return map[string]interface{}{
		"id":        strconv.FormatUint(uint64(m.ID), 10),
		"key":       m.Key,
		"value":     m.Value,
		"type":      m.Type,
		"sortOrder": m.SortOrder,
	}
}

func FormatAttachment(a models.CommentAttachment) map[string]interface{} {
	return map[string]interface{}{
		"id":        strconv.FormatUint(uint64(a.ID), 10),
		"url":       a.URL,
		"fileName":  a.FileName,
		"fileType":  a.FileType,
		"sizeBytes": a.SizeBytes,
	}
}

func FormatComment(c models.TaskComment, currentUserKode string) map[string]interface{} {
	replies := make([]map[string]interface{}, len(c.Replies))
	for i, r := range c.Replies {
		replies[i] = FormatComment(r, currentUserKode)
	}
	attachments := make([]map[string]interface{}, len(c.Attachments))
	for i, a := range c.Attachments {
		attachments[i] = FormatAttachment(a)
	}

	grouped := map[string]int{}
	reactedByMe := map[string]bool{}
	for _, r := range c.Reactions {
		grouped[r.Emoji]++
		if r.UserKode == currentUserKode {
			reactedByMe[r.Emoji] = true
		}
	}
	reactions := make([]map[string]interface{}, 0, len(grouped))
	for emoji, count := range grouped {
		reactions = append(reactions, map[string]interface{}{
			"emoji":   emoji,
			"count":   count,
			"reacted": reactedByMe[emoji],
		})
	}

	var parentID interface{}
	if c.ParentID != nil {
		parentID = strconv.FormatUint(uint64(*c.ParentID), 10)
	}

	return map[string]interface{}{
		"id":          strconv.FormatUint(uint64(c.ID), 10),
		"content":     c.Content,
		"userKode":    c.UserKode,
		"createdAt":   FormatTime(c.CreatedAt),
		"parentId":    parentID,
		"replies":     replies,
		"reactions":   reactions,
		"attachments": attachments,
	}
}

func FormatUser(u models.User) map[string]interface{} {
	var peg map[string]interface{}
	if u.Pegawai != nil {
		var jab map[string]interface{}
		if u.Pegawai.Jabatan != nil {
			jab = map[string]interface{}{"kode": u.Pegawai.Jabatan.Kode, "nama": u.Pegawai.Jabatan.Nama}
		}
		var div map[string]interface{}
		if u.Pegawai.Divisi != nil {
			div = map[string]interface{}{"kode": u.Pegawai.Divisi.Kode, "nama": u.Pegawai.Divisi.Nama}
		}
		peg = map[string]interface{}{
			"kode":         u.Pegawai.Kode,
			"nama":         u.Pegawai.Nama,
			"kodejabatan":  u.Pegawai.KodeJabatan,
			"kodedivisi":   u.Pegawai.KodeDivisi,
			"statusLeader": u.Pegawai.StatusLeader,
			"jabatan":      jab,
			"divisi":       div,
		}
	}
	return map[string]interface{}{
		"kodeku":    u.Kodeku,
		"username":  u.Username,
		"avatarUrl": u.AvatarURL,
		"pegawai":   peg,
	}
}

func FormatColleague(p models.Pegawai) map[string]interface{} {
	var jab map[string]interface{}
	if p.Jabatan != nil {
		jab = map[string]interface{}{"kode": p.Jabatan.Kode, "nama": p.Jabatan.Nama}
	}
	return map[string]interface{}{
		"kodeku":       strconv.Itoa(p.Kode),
		"nama":         p.Nama,
		"jabatan":      jab,
		"statusLeader": p.StatusLeader,
		"avatarUrl":    nil,
	}
}

func BuildActorContext(ctx context.Context, repos *repository.Repositories, claims *auth.Claims) (auth.ActorContext, error) {
	isLeader := false
	if pegawai, err := repos.Pegawai.FindByKode(ctx, claims.ExternalToken, claims.KodeDivisi, claims.PegawaiKode); err == nil {
		isLeader = pegawai.StatusLeader == 1
	}
	return auth.ActorContext{
		Kodeku:           claims.Kodeku,
		DivisiKode:       claims.KodeDivisi,
		IsDivisionLeader: isLeader,
	}, nil
}

func MustAtoi(s string) int {
	n, _ := strconv.Atoi(s)
	return n
}

func ParseDatePtr(v interface{}) *time.Time {
	if v == nil {
		return nil
	}
	s, ok := v.(string)
	if !ok || s == "" {
		return nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil
	}
	return &t
}

func FormatDatePtr(t *time.Time) interface{} {
	if t == nil {
		return nil
	}
	return t.Format("2006-01-02")
}

func FormatProjectStageHistory(sh models.ProjectStageHistory) map[string]interface{} {
	return map[string]interface{}{
		"id":        strconv.FormatUint(uint64(sh.ID), 10),
		"fromStage": sh.FromStage,
		"toStage":   sh.ToStage,
		"changedBy": sh.ChangedBy,
		"changedAt": FormatTime(sh.ChangedAt),
		"note":      sh.Note,
	}
}

func FormatDivisionProgress(dp models.DivisionProgress) map[string]interface{} {
	return map[string]interface{}{
		"divisiKode":     dp.DivisiKode,
		"divisiNama":     dp.DivisiNama,
		"totalTasks":     dp.TotalTasks,
		"completedTasks": dp.CompletedTasks,
		"percentDone":    dp.PercentDone,
	}
}

func FormatProject(project models.Project) map[string]interface{} {
	divisions := make([]int, len(project.Divisions))
	for i, d := range project.Divisions {
		divisions[i] = d.DivisiKode
	}
	leaders := make([]string, len(project.Leaders))
	for i, l := range project.Leaders {
		leaders[i] = l.PegawaiKode
	}
	histories := make([]map[string]interface{}, len(project.StageHistory))
	for i, h := range project.StageHistory {
		histories[i] = FormatProjectStageHistory(h)
	}

	stage := project.Stage
	if stage == "" {
		stage = models.ProjectStagePlanning
	}
	stageVersion := project.StageVersion
	if stageVersion == 0 {
		stageVersion = 1
	}

	return map[string]interface{}{
		"id":               strconv.FormatUint(uint64(project.ID), 10),
		"name":             project.Name,
		"description":      project.Description,
		"ownerDivisiKode":  project.OwnerDivisiKode,
		"status":           string(project.Status),
		"stage":            stage,
		"stageVersion":     stageVersion,
		"createdAt":        FormatTime(project.CreatedAt),
		"divisions":        divisions,
		"leaders":          leaders,
		"stageHistory":     histories,
		"divisionProgress": make([]map[string]interface{}, 0),
	}
}

func FormatProjectWithDetails(project models.Project, divProgress []models.DivisionProgress) map[string]interface{} {
	m := FormatProject(project)
	dpList := make([]map[string]interface{}, len(divProgress))
	for i, dp := range divProgress {
		dpList[i] = FormatDivisionProgress(dp)
	}
	m["divisionProgress"] = dpList
	return m
}

func FormatProjects(projects []models.Project) []map[string]interface{} {
	result := make([]map[string]interface{}, len(projects))
	for i, p := range projects {
		result[i] = FormatProject(p)
	}
	return result
}
