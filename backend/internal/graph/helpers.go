package graph

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"golang-todo/internal/auth"
	"golang-todo/internal/models"
	"golang-todo/internal/repository"
)

func parseID(v interface{}) (uint, error) {
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

func strVal(v interface{}) string {
	if v == nil {
		return ""
	}
	return v.(string)
}

func formatTime(t time.Time) string {
	return t.Format(time.RFC3339)
}

func formatSubtask(s models.Subtask) map[string]interface{} {
	return map[string]interface{}{
		"id":          strconv.FormatUint(uint64(s.ID), 10),
		"taskId":      strconv.FormatUint(uint64(s.TaskID), 10),
		"description": s.Description,
		"status":      s.Status,
		"sortOrder":   s.SortOrder,
		"createdAt":   formatTime(s.CreatedAt),
		"updatedAt":   formatTime(s.UpdatedAt),
	}
}

func formatTask(task models.Task, currentUserKode string) map[string]interface{} {
	comments := make([]map[string]interface{}, 0)
	for _, c := range task.Comments {
		if c.ParentID == nil { // hanya top-level, replies sudah nested di dalamnya
			comments = append(comments, formatComment(c, currentUserKode))
		}
	}
	meta := make([]map[string]interface{}, len(task.Meta))
	for i, m := range task.Meta {
		meta[i] = formatMeta(m)
	}
	subtasks := make([]map[string]interface{}, len(task.Subtasks))
	for i, s := range task.Subtasks {
		subtasks[i] = formatSubtask(s)
	}
	return map[string]interface{}{
		"id":          strconv.FormatUint(uint64(task.ID), 10),
		"title":       task.Title,
		"description": task.Description,
		"status":      task.Status,
		"userKode":    task.UserKode,
		"createdBy":   task.CreatedBy,
		"startDate":   formatDatePtr(task.StartDate),   // <-- baru
		"dueDate":     formatDatePtr(task.DueDate),     // <-- baru
		"completedAt": formatDatePtr(task.CompletedAt), // <-- baru
		"createdAt":   formatTime(task.CreatedAt),
		"updatedAt":   formatTime(task.UpdatedAt),
		"sortOrder":   task.SortOrder,
		"comments":    comments,
		"meta":        meta,
		"subtasks":    subtasks,
	}
}

func formatTasks(tasks []models.Task, currentUserKode string) []map[string]interface{} {
	result := make([]map[string]interface{}, len(tasks))
	for i, t := range tasks {
		result[i] = formatTask(t, currentUserKode)
	}
	return result
}

func formatMeta(m models.TaskMeta) map[string]interface{} {
	return map[string]interface{}{
		"id":        strconv.FormatUint(uint64(m.ID), 10),
		"key":       m.Key,
		"value":     m.Value,
		"type":      m.Type,
		"sortOrder": m.SortOrder,
	}
}

func formatAttachment(a models.CommentAttachment) map[string]interface{} {
	return map[string]interface{}{
		"id":        strconv.FormatUint(uint64(a.ID), 10),
		"url":       a.URL,
		"fileName":  a.FileName,
		"fileType":  a.FileType,
		"sizeBytes": a.SizeBytes,
	}
}

// formatComment butuh currentUserKode buat tahu status "reacted"
func formatComment(c models.TaskComment, currentUserKode string) map[string]interface{} {
	replies := make([]map[string]interface{}, len(c.Replies))
	for i, r := range c.Replies {
		replies[i] = formatComment(r, currentUserKode)
	}
	attachments := make([]map[string]interface{}, len(c.Attachments))
	for i, a := range c.Attachments {
		attachments[i] = formatAttachment(a)
	}

	// group reactions by emoji
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
		"createdAt":   formatTime(c.CreatedAt),
		"parentId":    parentID,
		"replies":     replies,
		"reactions":   reactions,
		"attachments": attachments,
	}
}

func formatUser(u models.User) map[string]interface{} {
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

func formatColleague(p models.Pegawai) map[string]interface{} {
	var jab map[string]interface{}
	if p.Jabatan != nil {
		jab = map[string]interface{}{"kode": p.Jabatan.Kode, "nama": p.Jabatan.Nama}
	}
	return map[string]interface{}{
		"kodeku":       strconv.Itoa(p.Kode), // kode pegawai, stringified
		"nama":         p.Nama,
		"jabatan":      jab,
		"statusLeader": p.StatusLeader,
		"avatarUrl":    nil, // API directory gak kasih avatar per-orang; biar frontend fallback ke inisial
	}
}

func buildActorContext(ctx context.Context, repos *repository.Repositories, claims *auth.Claims) (auth.ActorContext, error) {
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

func mustAtoi(s string) int {
	n, _ := strconv.Atoi(s)
	return n
}

// parseDatePtr menerima value argumen GraphQL bertipe string tanggal ("YYYY-MM-DD")
// dan mengembalikan *time.Time, atau nil kalau kosong/tidak valid.
func parseDatePtr(v interface{}) *time.Time {
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

// formatDatePtr kebalikan dari parseDatePtr, dipakai saat mengembalikan Task ke GraphQL.
func formatDatePtr(t *time.Time) interface{} {
	if t == nil {
		return nil
	}
	return t.Format("2006-01-02")
}

func formatProject(project models.Project) map[string]interface{} {
	divisions := make([]int, len(project.Divisions))
	for i, d := range project.Divisions {
		divisions[i] = d.DivisiKode
	}
	leaders := make([]string, len(project.Leaders))
	for i, l := range project.Leaders {
		leaders[i] = l.PegawaiKode
	}
	return map[string]interface{}{
		"id":              strconv.FormatUint(uint64(project.ID), 10),
		"name":            project.Name,
		"description":     project.Description,
		"ownerDivisiKode": project.OwnerDivisiKode,
		"status":          string(project.Status),
		"createdAt":       formatTime(project.CreatedAt),
		"divisions":       divisions,
		"leaders":         leaders,
	}
}

func formatProjects(projects []models.Project) []map[string]interface{} {
	result := make([]map[string]interface{}, len(projects))
	for i, p := range projects {
		result[i] = formatProject(p)
	}
	return result
}
