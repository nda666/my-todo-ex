package graph

import (
	"github.com/graphql-go/graphql"
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
	ProjectStageEnum           *graphql.Enum
	ProjectStageHistoryType    *graphql.Object
	DivisionProgressType       *graphql.Object
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
	MetaTypeEnum               *graphql.Enum
}

func buildTypes() *Types {
	user := buildUserTypes()
	task := buildTaskTypes()
	proj := buildProjectTypes()
	dora := buildDoraTypes()

	return &Types{
		TaskStatusEnum:             task.TaskStatusEnum,
		JabatanType:                user.JabatanType,
		DivisiType:                 user.DivisiType,
		DivisionSummaryType:        user.DivisionSummaryType,
		PegawaiType:                user.PegawaiType,
		ColleagueType:              user.ColleagueType,
		UserType:                   user.UserType,
		ProjectType:                proj.ProjectType,
		ProjectStageEnum:           proj.ProjectStageEnum,
		ProjectStageHistoryType:    proj.ProjectStageHistoryType,
		DivisionProgressType:       proj.DivisionProgressType,
		TaskMetaType:               task.TaskMetaType,
		TaskCommentType:            task.TaskCommentType,
		TaskType:                   task.TaskType,
		SubtaskType:                task.SubtaskType,
		SubtaskStatusEnum:          task.SubtaskStatusEnum,
		TaskConnectionType:         task.TaskConnectionType,
		AuthPayloadType:            user.AuthPayloadType,
		CreateTaskInput:            task.CreateTaskInput,
		UpdateTaskInput:            task.UpdateTaskInput,
		CreateSubtaskInput:         task.CreateSubtaskInput,
		UpdateSubtaskInput:         task.UpdateSubtaskInput,
		MetaTypeEnum:               task.MetaTypeEnum,
		CommentAttachmentType:      task.CommentAttachmentType,
		CommentAttachmentInputType: task.CommentAttachmentInputType,
		ReactionSummaryType:        task.ReactionSummaryType,
		DoraResponseType:           dora.DoraResponseType,
		DoraMessageInputType:       dora.DoraMessageInputType,
		DoraTaskItemType:           dora.DoraTaskItemType,
		DoraSuggestedActionType:    dora.DoraSuggestedActionType,
	}
}
