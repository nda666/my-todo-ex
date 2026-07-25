import { gql } from '@apollo/client';

// ==========================================
// FRAGMENTS (Reusable Fields)
// ==========================================

export const USER_FIELDS = gql`
  fragment UserFields on User {
    kodeku
    username
    avatarUrl
    pegawai {
      kode
      nama
      kodejabatan
      kodedivisi
      statusLeader
      jabatan {
        kode
        nama
      }
      divisi {
        kode
        nama
      }
    }
  }
`;

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

export const PROJECT_FIELDS = gql`
  fragment ProjectFields on Project {
    id
    name
    description
    ownerDivisiKode
    status
    createdAt
    divisions
    leaders
  }
`;

// ==========================================
// QUERIES & MUTATIONS
// ==========================================

export const ME = gql`
  ${USER_FIELDS}
  query Me {
    me {
      ...UserFields
    }
  }
`;

export const LOGIN = gql`
  ${USER_FIELDS}
  mutation Login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      token
      user {
        ...UserFields
      }
    }
  }
`;

export const GET_TASKS = gql`
  ${TASK_FIELDS}
  query GetTasks(
    $limit: Int
    $cursor: String
    $userKode: String
    $search: String
    $startDate: String
    $dueDate: String
    $projectId: ID
  ) {
    tasks(
      limit: $limit
      cursor: $cursor
      userKode: $userKode
      search: $search
      startDate: $startDate
      dueDate: $dueDate
      projectId: $projectId
    ) {
      tasks {
        ...TaskFields
      }
      nextCursor
      hasMore
    }
  }
`;

export const GET_COLLEAGUES = gql`
  query GetColleagues {
    colleagues {
      kodeku
      nama
      statusLeader
      avatarUrl
      jabatan {
        kode
        nama
      }
    }
  }
`;

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

export const GET_DIVISIONS = gql`
  query GetDivisions {
    divisions {
      kode
      nama
    }
  }
`;

export const GET_COLLEAGUES_BY_DIVISI = gql`
  query GetColleaguesByDivisi($divisiKode: Int!, $search: String) {
    colleaguesByDivisi(divisiKode: $divisiKode, search: $search) {
      kodeku
      nama
      statusLeader
      avatarUrl
      jabatan {
        kode
        nama
      }
    }
  }
`;

export const GET_TEAMS_SUMMARY = gql`
  query GetTeamsSummary {
    teamsSummary {
      kode
      nama
      leaderName
      memberCount
      iconKey
      color
    }
  }
`;

// frontend/src/lib/queries.ts — only ASK_DORA changed, rest of file unchanged
// frontend/src/lib/queries.ts — hanya ASK_DORA yang berubah
export const ASK_DORA = gql`
  mutation AskDora($message: String!, $sessionId: String!) {
    askDora(message: $message, sessionId: $sessionId) {
      reply
      suggestedAction {
        type
        title
        description
        targetUserKode
        startDate
        endDate
        styleNotes
        divisions
        tasks {
          title
          description
          targetUserKode
        }
        divisionCandidates {
          kode
          nama
        }
      }
    }
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

export const GET_TEAM_OVERVIEW = gql`
  query TeamOverview {
    tasks(limit: 200) {
      tasks {
        id
        userKode
      }
    }
  }
`;

export const GET_PROJECTS = gql`
  ${PROJECT_FIELDS}
  query GetProjects {
    projects {
      ...ProjectFields
    }
  }
`;

export const GET_PROJECT = gql`
  ${PROJECT_FIELDS}
  query GetProject($id: ID!) {
    project(id: $id) {
      ...ProjectFields
    }
  }
`;

export const GET_PROJECT_TASKS = gql`
  ${TASK_FIELDS}
  query GetProjectTasks($projectId: ID!, $limit: Int, $cursor: String) {
    projectTasks(projectId: $projectId, limit: $limit, cursor: $cursor) {
      tasks {
        ...TaskFields
      }
      nextCursor
      hasMore
    }
  }
`;

export const CREATE_PROJECT = gql`
  ${PROJECT_FIELDS}
  mutation CreateProject($name: String!, $description: String) {
    createProject(name: $name, description: $description) {
      ...ProjectFields
    }
  }
`;

export const INVITE_DIVISION = gql`
  mutation InviteDivision($projectId: ID!, $divisiKode: Int!) {
    inviteDivisionToProject(projectId: $projectId, divisiKode: $divisiKode)
  }
`;

export const REMOVE_DIVISION = gql`
  mutation RemoveDivision($projectId: ID!, $divisiKode: Int!) {
    removeDivisionFromProject(projectId: $projectId, divisiKode: $divisiKode)
  }
`;

export const ADD_PROJECT_LEADER = gql`
  mutation AddProjectLeader($projectId: ID!, $pegawaiKode: String!) {
    addProjectLeader(projectId: $projectId, pegawaiKode: $pegawaiKode)
  }
`;

export const REMOVE_PROJECT_LEADER = gql`
  mutation RemoveProjectLeader($projectId: ID!, $pegawaiKode: String!) {
    removeProjectLeader(projectId: $projectId, pegawaiKode: $pegawaiKode)
  }
`;

export const CREATE_PROJECT_TASK = gql`
  mutation CreateProjectTask(
    $projectId: ID!
    $title: String!
    $description: String
    $targetUserKode: String
    $startDate: String
    $dueDate: String
  ) {
    createProjectTask(
      projectId: $projectId
      title: $title
      description: $description
      targetUserKode: $targetUserKode
      startDate: $startDate
      dueDate: $dueDate
    ) {
      id
      title
      status
      userKode
    }
  }
`;

export const REASSIGN_PROJECT_TASK = gql`
  mutation ReassignProjectTask($taskId: ID!, $targetUserKode: String!) {
    reassignProjectTask(taskId: $taskId, targetUserKode: $targetUserKode) {
      id
      userKode
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
