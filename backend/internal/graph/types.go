package graph

import (
	"golang-todo/internal/models"

	"github.com/graphql-go/graphql"
)

var (
	// Declare dulu sebagai package-level var
	taskCommentType *graphql.Object
	// ... other types
)

// Types menampung semua GraphQL type supaya bisa dipakai bareng
// di query.go dan mutation.go tanpa didefinisikan ulang.
type Types struct {
	TaskStatusEnum             *graphql.Enum
	JabatanType                *graphql.Object
	DivisiType                 *graphql.Object
	DivisionSummaryType        *graphql.Object
	PegawaiType                *graphql.Object
	ColleagueType              *graphql.Object
	UserType                   *graphql.Object
	ProjectType                *graphql.Object
	TaskMetaType               *graphql.Object
	TaskCommentType            *graphql.Object
	TaskType                   *graphql.Object
	SubtaskType                *graphql.Object
	SubtaskStatusEnum          *graphql.Enum
	TaskConnectionType         *graphql.Object
	AuthPayloadType            *graphql.Object
	ReactionSummaryType        *graphql.Object
	CommentAttachmentType      *graphql.Object
	DoraResponseType           *graphql.Object
	DoraTaskItemType           *graphql.Object
	DoraSuggestedActionType    *graphql.Object
	CreateTaskInput            *graphql.InputObject
	UpdateTaskInput            *graphql.InputObject
	CreateSubtaskInput         *graphql.InputObject
	UpdateSubtaskInput         *graphql.InputObject
	DoraMessageInputType       *graphql.InputObject
	CommentAttachmentInputType *graphql.InputObject

	MetaTypeEnum *graphql.Enum
}

func buildTypes() *Types {
	taskStatusEnum := graphql.NewEnum(graphql.EnumConfig{
		Name: "TaskStatus",
		Values: graphql.EnumValueConfigMap{
			"PENDING":     &graphql.EnumValueConfig{Value: models.TaskStatusPending},
			"IN_PROGRESS": &graphql.EnumValueConfig{Value: models.TaskStatusInProgress},
			"COMPLETED":   &graphql.EnumValueConfig{Value: models.TaskStatusCompleted},
		},
	})

	subtaskStatusEnum := graphql.NewEnum(graphql.EnumConfig{
		Name: "SubtaskStatus",
		Values: graphql.EnumValueConfigMap{
			"PENDING":   &graphql.EnumValueConfig{Value: models.SubtaskStatusPending},
			"COMPLETED": &graphql.EnumValueConfig{Value: models.SubtaskStatusCompleted},
		},
	})

	subtaskType := graphql.NewObject(graphql.ObjectConfig{
		Name: "Subtask",
		Fields: graphql.Fields{
			"id":          &graphql.Field{Type: graphql.NewNonNull(graphql.ID)},
			"taskId":      &graphql.Field{Type: graphql.NewNonNull(graphql.ID)},
			"description": &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"status":      &graphql.Field{Type: graphql.NewNonNull(subtaskStatusEnum)},
			"sortOrder":   &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"createdAt":   &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"updatedAt":   &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
		},
	})

	createSubtaskInput := graphql.NewInputObject(graphql.InputObjectConfig{
		Name: "CreateSubtaskInput",
		Fields: graphql.InputObjectConfigFieldMap{
			"taskId":      &graphql.InputObjectFieldConfig{Type: graphql.NewNonNull(graphql.ID)},
			"description": &graphql.InputObjectFieldConfig{Type: graphql.NewNonNull(graphql.String)},
			"status":      &graphql.InputObjectFieldConfig{Type: subtaskStatusEnum},
		},
	})

	updateSubtaskInput := graphql.NewInputObject(graphql.InputObjectConfig{
		Name: "UpdateSubtaskInput",
		Fields: graphql.InputObjectConfigFieldMap{
			"description": &graphql.InputObjectFieldConfig{Type: graphql.String},
			"status":      &graphql.InputObjectFieldConfig{Type: subtaskStatusEnum},
		},
	})
	jabatanType := graphql.NewObject(graphql.ObjectConfig{
		Name: "Jabatan",
		Fields: graphql.Fields{
			"kode": &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"nama": &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
		},
	})

	divisiType := graphql.NewObject(graphql.ObjectConfig{
		Name: "Divisi",
		Fields: graphql.Fields{
			"kode": &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"nama": &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
		},
	})

	divisionSummaryType := graphql.NewObject(graphql.ObjectConfig{
		Name: "DivisionSummary",
		Fields: graphql.Fields{
			"kode":        &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"nama":        &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"leaderName":  &graphql.Field{Type: graphql.String},
			"memberCount": &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"iconKey":     &graphql.Field{Type: graphql.NewNonNull(graphql.String)}, // <-- ganti avatarUrl
			"color":       &graphql.Field{Type: graphql.NewNonNull(graphql.String)}, // <-- baru
		},
	})

	pegawaiType := graphql.NewObject(graphql.ObjectConfig{
		Name: "Pegawai",
		Fields: graphql.Fields{
			"kode":         &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"nama":         &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"kodejabatan":  &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"kodedivisi":   &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"statusLeader": &graphql.Field{Type: graphql.NewNonNull(graphql.Int)}, // <-- baru
			"jabatan":      &graphql.Field{Type: jabatanType},
			"divisi":       &graphql.Field{Type: divisiType},
		},
	})

	colleagueType := graphql.NewObject(graphql.ObjectConfig{
		Name: "Colleague",
		Fields: graphql.Fields{
			"kodeku":       &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"nama":         &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"jabatan":      &graphql.Field{Type: jabatanType},
			"statusLeader": &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"avatarUrl":    &graphql.Field{Type: graphql.String},
		},
	})

	userType := graphql.NewObject(graphql.ObjectConfig{
		Name: "User",
		Fields: graphql.Fields{
			"kodeku":    &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"username":  &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"pegawai":   &graphql.Field{Type: pegawaiType},
			"avatarUrl": &graphql.Field{Type: graphql.String},
		},
	})

	metaTypeEnum := graphql.NewEnum(graphql.EnumConfig{
		Name: "MetaType",
		Values: graphql.EnumValueConfigMap{
			"TEXT":  &graphql.EnumValueConfig{Value: models.MetaTypeText},
			"LINK":  &graphql.EnumValueConfig{Value: models.MetaTypeLink},
			"COLOR": &graphql.EnumValueConfig{Value: models.MetaTypeColor},
			"DATE":  &graphql.EnumValueConfig{Value: models.MetaTypeDate},
			"FILE":  &graphql.EnumValueConfig{Value: models.MetaTypeFile},
			"IMAGE": &graphql.EnumValueConfig{Value: models.MetaTypeImage},
		},
	})

	taskMetaType := graphql.NewObject(graphql.ObjectConfig{
		Name: "TaskMeta",
		Fields: graphql.Fields{
			"id":        &graphql.Field{Type: graphql.NewNonNull(graphql.ID)},
			"key":       &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"value":     &graphql.Field{Type: graphql.String},
			"type":      &graphql.Field{Type: graphql.NewNonNull(metaTypeEnum)},
			"sortOrder": &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
		},
	})

	commentAttachmentType := graphql.NewObject(graphql.ObjectConfig{
		Name: "CommentAttachment",
		Fields: graphql.Fields{
			"id":        &graphql.Field{Type: graphql.NewNonNull(graphql.ID)},
			"url":       &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"fileName":  &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"fileType":  &graphql.Field{Type: graphql.String},
			"sizeBytes": &graphql.Field{Type: graphql.Int},
		},
	})

	reactionSummaryType := graphql.NewObject(graphql.ObjectConfig{
		Name: "ReactionSummary",
		Fields: graphql.Fields{
			"emoji":   &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"count":   &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"reacted": &graphql.Field{Type: graphql.NewNonNull(graphql.Boolean)}, // apakah current user sudah react emoji ini
		},
	})

	commentAttachmentInputType := graphql.NewInputObject(graphql.InputObjectConfig{
		Name: "CommentAttachmentInput",
		Fields: graphql.InputObjectConfigFieldMap{
			"url":       &graphql.InputObjectFieldConfig{Type: graphql.NewNonNull(graphql.String)},
			"fileName":  &graphql.InputObjectFieldConfig{Type: graphql.NewNonNull(graphql.String)},
			"fileType":  &graphql.InputObjectFieldConfig{Type: graphql.String},
			"sizeBytes": &graphql.InputObjectFieldConfig{Type: graphql.Int},
		},
	})

	// taskCommentType - Recursive type pakai = supaya asign ke var package jangan := karena nanti error panic
	taskCommentType = graphql.NewObject(graphql.ObjectConfig{
		Name: "TaskComment",
		Fields: graphql.FieldsThunk(func() graphql.Fields {
			return graphql.Fields{
				"id":        &graphql.Field{Type: graphql.NewNonNull(graphql.ID)},
				"content":   &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
				"userKode":  &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
				"createdAt": &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
				"parentId":  &graphql.Field{Type: graphql.ID},
				"replies": &graphql.Field{
					Type: graphql.NewList(graphql.NewNonNull(taskCommentType)), // recursive
				},
				"reactions": &graphql.Field{
					Type: graphql.NewList(graphql.NewNonNull(reactionSummaryType)),
				},
				"attachments": &graphql.Field{
					Type: graphql.NewList(graphql.NewNonNull(commentAttachmentType)),
				},
			}
		}),
	})

	taskType := graphql.NewObject(graphql.ObjectConfig{
		Name: "Task",
		Fields: graphql.FieldsThunk(func() graphql.Fields {
			return graphql.Fields{
				"id":          &graphql.Field{Type: graphql.NewNonNull(graphql.ID)},
				"title":       &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
				"description": &graphql.Field{Type: graphql.String},
				"status":      &graphql.Field{Type: graphql.NewNonNull(taskStatusEnum)},
				"createdAt":   &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
				"updatedAt":   &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
				"userKode":    &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
				"createdBy":   &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
				"startDate":   &graphql.Field{Type: graphql.String},
				"dueDate":     &graphql.Field{Type: graphql.String},
				"completedAt": &graphql.Field{Type: graphql.String},
				"sortOrder":   &graphql.Field{Type: graphql.Int},
				"comments": &graphql.Field{
					Type: graphql.NewList(graphql.NewNonNull(taskCommentType)),
				},
				"meta": &graphql.Field{
					Type: graphql.NewList(graphql.NewNonNull(taskMetaType)),
				},
				"subtasks": &graphql.Field{
					Type: graphql.NewList(graphql.NewNonNull(subtaskType)),
				},
			}
		}),
	})

	projectType := graphql.NewObject(graphql.ObjectConfig{
		Name: "Project",
		Fields: graphql.Fields{
			"id":              &graphql.Field{Type: graphql.NewNonNull(graphql.ID)},
			"name":            &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"description":     &graphql.Field{Type: graphql.String},
			"ownerDivisiKode": &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"status":          &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"createdAt":       &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"divisions":       &graphql.Field{Type: graphql.NewList(graphql.NewNonNull(graphql.Int))},
			"leaders":         &graphql.Field{Type: graphql.NewList(graphql.NewNonNull(graphql.String))},
		},
	})

	taskConnectionType := graphql.NewObject(graphql.ObjectConfig{
		Name: "TaskConnection",
		Fields: graphql.Fields{
			"tasks":      &graphql.Field{Type: graphql.NewList(graphql.NewNonNull(taskType))},
			"nextCursor": &graphql.Field{Type: graphql.String},
			"hasMore":    &graphql.Field{Type: graphql.NewNonNull(graphql.Boolean)},
		},
	})

	authPayloadType := graphql.NewObject(graphql.ObjectConfig{
		Name: "AuthPayload",
		Fields: graphql.Fields{
			"token": &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"user":  &graphql.Field{Type: graphql.NewNonNull(userType)},
		},
	})

	metaInputType := graphql.NewInputObject(graphql.InputObjectConfig{
		Name: "TaskMetaInput",
		Fields: graphql.InputObjectConfigFieldMap{
			"key":   &graphql.InputObjectFieldConfig{Type: graphql.NewNonNull(graphql.String)},
			"value": &graphql.InputObjectFieldConfig{Type: graphql.String},
			"type":  &graphql.InputObjectFieldConfig{Type: graphql.NewNonNull(metaTypeEnum)},
		},
	})

	createTaskInput := graphql.NewInputObject(graphql.InputObjectConfig{
		Name: "CreateTaskInput",
		Fields: graphql.InputObjectConfigFieldMap{
			"title":          &graphql.InputObjectFieldConfig{Type: graphql.NewNonNull(graphql.String)},
			"description":    &graphql.InputObjectFieldConfig{Type: graphql.String},
			"status":         &graphql.InputObjectFieldConfig{Type: taskStatusEnum},
			"targetUserKode": &graphql.InputObjectFieldConfig{Type: graphql.String},
			"meta":           &graphql.InputObjectFieldConfig{Type: graphql.NewList(metaInputType)},
			"projectId":      &graphql.InputObjectFieldConfig{Type: graphql.ID},
			"startDate":      &graphql.InputObjectFieldConfig{Type: graphql.String},
			"dueDate":        &graphql.InputObjectFieldConfig{Type: graphql.String},
			"subtasks":       &graphql.InputObjectFieldConfig{Type: graphql.NewList(graphql.String)},
		},
	})

	updateTaskInput := graphql.NewInputObject(graphql.InputObjectConfig{
		Name: "UpdateTaskInput",
		Fields: graphql.InputObjectConfigFieldMap{
			"title":       &graphql.InputObjectFieldConfig{Type: graphql.String},
			"description": &graphql.InputObjectFieldConfig{Type: graphql.String},
			"status":      &graphql.InputObjectFieldConfig{Type: taskStatusEnum},
			"startDate":   &graphql.InputObjectFieldConfig{Type: graphql.String},
			"dueDate":     &graphql.InputObjectFieldConfig{Type: graphql.String},
			"meta":        &graphql.InputObjectFieldConfig{Type: graphql.NewList(metaInputType)},
		},
	})

	doraMessageInputType := graphql.NewInputObject(graphql.InputObjectConfig{
		Name: "DoraMessageInput",
		Fields: graphql.InputObjectConfigFieldMap{
			"role":    &graphql.InputObjectFieldConfig{Type: graphql.NewNonNull(graphql.String)},
			"content": &graphql.InputObjectFieldConfig{Type: graphql.NewNonNull(graphql.String)},
		},
	})

	// backend/internal/graph/types.go — only buildTypes() DoraSuggestedAction section changed
	doraTaskItemType := graphql.NewObject(graphql.ObjectConfig{
		Name: "DoraTaskItem",
		Fields: graphql.Fields{
			"title":          &graphql.Field{Type: graphql.String},
			"description":    &graphql.Field{Type: graphql.String},
			"targetUserKode": &graphql.Field{Type: graphql.String},
		},
	})

	doraDivisionCandidateType := graphql.NewObject(graphql.ObjectConfig{
		Name: "DoraDivisionCandidate",
		Fields: graphql.Fields{
			"kode": &graphql.Field{Type: graphql.NewNonNull(graphql.Int)},
			"nama": &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
		},
	})

	doraSuggestedActionType := graphql.NewObject(graphql.ObjectConfig{
		Name: "DoraSuggestedAction",
		Fields: graphql.Fields{
			"type":               &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"title":              &graphql.Field{Type: graphql.String},
			"description":        &graphql.Field{Type: graphql.String},
			"targetUserKode":     &graphql.Field{Type: graphql.String},
			"startDate":          &graphql.Field{Type: graphql.String},
			"endDate":            &graphql.Field{Type: graphql.String},
			"styleNotes":         &graphql.Field{Type: graphql.String},
			"tasks":              &graphql.Field{Type: graphql.NewList(doraTaskItemType)},
			"divisions":          &graphql.Field{Type: graphql.NewList(graphql.Int)},
			"divisionCandidates": &graphql.Field{Type: graphql.NewList(doraDivisionCandidateType)},
		},
	})

	doraResponseType := graphql.NewObject(graphql.ObjectConfig{
		Name: "DoraResponse",
		Fields: graphql.Fields{
			"reply":           &graphql.Field{Type: graphql.NewNonNull(graphql.String)},
			"suggestedAction": &graphql.Field{Type: doraSuggestedActionType},
		},
	})

	return &Types{
		TaskStatusEnum:             taskStatusEnum,
		JabatanType:                jabatanType,
		DivisiType:                 divisiType,
		DivisionSummaryType:        divisionSummaryType,
		PegawaiType:                pegawaiType,
		ColleagueType:              colleagueType,
		UserType:                   userType,
		ProjectType:                projectType,
		TaskMetaType:               taskMetaType,
		TaskCommentType:            taskCommentType,
		TaskType:                   taskType,
		SubtaskType:                subtaskType,
		SubtaskStatusEnum:          subtaskStatusEnum,
		TaskConnectionType:         taskConnectionType,
		AuthPayloadType:            authPayloadType,
		CreateTaskInput:            createTaskInput,
		UpdateTaskInput:            updateTaskInput,
		CreateSubtaskInput:         createSubtaskInput,
		UpdateSubtaskInput:         updateSubtaskInput,
		MetaTypeEnum:               metaTypeEnum,
		CommentAttachmentType:      commentAttachmentType,
		CommentAttachmentInputType: commentAttachmentInputType,
		ReactionSummaryType:        reactionSummaryType,
		DoraResponseType:           doraResponseType,
		DoraMessageInputType:       doraMessageInputType,
		DoraTaskItemType:           doraTaskItemType,
		DoraSuggestedActionType:    doraSuggestedActionType,
	}
}
