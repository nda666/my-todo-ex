package graph

import (
	"golang-todo/internal/models"

	"github.com/graphql-go/graphql"
)

var (
	// Package-level var for recursive TaskComment type
	taskCommentType *graphql.Object
)

type taskTypes struct {
	TaskStatusEnum             *graphql.Enum
	SubtaskStatusEnum          *graphql.Enum
	MetaTypeEnum               *graphql.Enum
	SubtaskType                *graphql.Object
	TaskMetaType               *graphql.Object
	CommentAttachmentType      *graphql.Object
	ReactionSummaryType        *graphql.Object
	TaskCommentType            *graphql.Object
	TaskType                   *graphql.Object
	TaskConnectionType         *graphql.Object
	CreateTaskInput            *graphql.InputObject
	UpdateTaskInput            *graphql.InputObject
	CreateSubtaskInput         *graphql.InputObject
	UpdateSubtaskInput         *graphql.InputObject
	CommentAttachmentInputType *graphql.InputObject
}

func buildTaskTypes() taskTypes {
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
			"reacted": &graphql.Field{Type: graphql.NewNonNull(graphql.Boolean)},
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
					Type: graphql.NewList(graphql.NewNonNull(taskCommentType)),
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

	taskConnectionType := graphql.NewObject(graphql.ObjectConfig{
		Name: "TaskConnection",
		Fields: graphql.Fields{
			"tasks":      &graphql.Field{Type: graphql.NewList(graphql.NewNonNull(taskType))},
			"nextCursor": &graphql.Field{Type: graphql.String},
			"hasMore":    &graphql.Field{Type: graphql.NewNonNull(graphql.Boolean)},
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

	return taskTypes{
		TaskStatusEnum:             taskStatusEnum,
		SubtaskStatusEnum:          subtaskStatusEnum,
		MetaTypeEnum:               metaTypeEnum,
		SubtaskType:                subtaskType,
		TaskMetaType:               taskMetaType,
		CommentAttachmentType:      commentAttachmentType,
		ReactionSummaryType:        reactionSummaryType,
		TaskCommentType:            taskCommentType,
		TaskType:                   taskType,
		TaskConnectionType:         taskConnectionType,
		CreateTaskInput:            createTaskInput,
		UpdateTaskInput:            updateTaskInput,
		CreateSubtaskInput:         createSubtaskInput,
		UpdateSubtaskInput:         updateSubtaskInput,
		CommentAttachmentInputType: commentAttachmentInputType,
	}
}
