import { gql } from "@apollo/client";
import { TASK_FIELDS, COMMENT_FIELDS } from "./fragments";

export const CREATE_TASK = gql`
  ${TASK_FIELDS}
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      ...TaskFields
    }
  }
`;

export const UPDATE_TASK = gql`
  ${TASK_FIELDS}
  mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      ...TaskFields
    }
  }
`;

export const DELETE_TASK = gql`
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id)
  }
`;

export const ADD_COMMENT = gql`
  ${COMMENT_FIELDS}
  mutation AddComment(
    $taskId: ID!
    $content: String!
    $parentId: ID
    $attachments: [CommentAttachmentInput!]
  ) {
    addTaskComment(
      taskId: $taskId
      content: $content
      parentId: $parentId
      attachments: $attachments
    ) {
      ...CommentFields
      replies {
        ...CommentFields
      }
    }
  }
`;

export const TOGGLE_REACTION = gql`
  ${COMMENT_FIELDS}
  mutation ToggleReaction($commentId: ID!, $emoji: String!) {
    toggleReaction(commentId: $commentId, emoji: $emoji) {
      ...CommentFields
      replies {
        ...CommentFields
      }
    }
  }
`;

export const SET_META = gql`
  mutation SetMeta(
    $taskId: ID!
    $key: String!
    $value: String
    $type: MetaType
  ) {
    setTaskMeta(taskId: $taskId, key: $key, value: $value, type: $type) {
      id
      key
      value
      type
    }
  }
`;

export const DELETE_META = gql`
  mutation DeleteMeta($id: ID!) {
    deleteTaskMeta(id: $id)
  }
`;

export const REORDER_META = gql`
  mutation ReorderTaskMeta($taskId: ID!, $orderedIds: [ID!]) {
    reorderTaskMeta(taskId: $taskId, orderedIds: $orderedIds)
  }
`;

export const REORDER_TASKS = gql`
  mutation ReorderTasks($orderedIds: [ID!]) {
    reorderTasks(orderedIds: $orderedIds) {
      id
      sortOrder
    }
  }
`;

export const CREATE_SUBTASK = gql`
  mutation CreateSubtask($input: CreateSubtaskInput!) {
    createSubtask(input: $input) {
      id
      taskId
      description
      status
      sortOrder
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_SUBTASK = gql`
  mutation UpdateSubtask($id: ID!, $input: UpdateSubtaskInput!) {
    updateSubtask(id: $id, input: $input) {
      id
      taskId
      description
      status
      sortOrder
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_SUBTASK = gql`
  mutation DeleteSubtask($id: ID!) {
    deleteSubtask(id: $id)
  }
`;

export const REORDER_SUBTASKS = gql`
  mutation ReorderSubtasks($taskId: ID!, $orderedIds: [ID!]!) {
    reorderSubtasks(taskId: $taskId, orderedIds: $orderedIds) {
      id
      taskId
      description
      status
      sortOrder
    }
  }
`;
