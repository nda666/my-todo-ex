import { gql } from "@apollo/client";

export const COMMENT_FIELDS = gql`
  fragment CommentFields on TaskComment {
    id
    content
    userKode
    createdAt
    parentId
    reactions {
      emoji
      count
      reacted
    }
    attachments {
      id
      url
      fileName
      fileType
      sizeBytes
    }
  }
`;

export const TASK_FIELDS = gql`
  ${COMMENT_FIELDS}
  fragment TaskFields on Task {
    id
    title
    description
    status
    priority
    userKode
    sortOrder
    createdBy
    createdAt
    updatedAt
    meta {
      id
      key
      value
      type
    }
    subtasks {
      id
      taskId
      description
      status
      sortOrder
      createdAt
      updatedAt
    }
    comments {
      ...CommentFields
      replies {
        ...CommentFields
      }
    }
  }
`;
