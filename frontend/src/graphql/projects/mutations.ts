import { gql } from "@apollo/client";
import { PROJECT_FIELDS } from "./fragments";

export const CREATE_PROJECT = gql`
  ${PROJECT_FIELDS}
  mutation CreateProject(
    $name: String!
    $description: String
    $divisions: [Int!]
    $leaders: [String!]
  ) {
    createProject(
      name: $name
      description: $description
      divisions: $divisions
      leaders: $leaders
    ) {
      ...ProjectFields
    }
  }
`;

export const UPDATE_PROJECT_STAGE = gql`
  ${PROJECT_FIELDS}
  mutation UpdateProjectStage(
    $id: ID!
    $stage: ProjectStage!
    $note: String
    $stageVersion: Int!
  ) {
    updateProjectStage(
      id: $id
      stage: $stage
      note: $note
      stageVersion: $stageVersion
    ) {
      ...ProjectFields
    }
  }
`;

export const ATTACH_TASK_TO_PROJECT = gql`
  mutation AttachTaskToProject($projectId: ID!, $taskId: ID!) {
    attachTaskToProject(projectId: $projectId, taskId: $taskId)
  }
`;

export const DETACH_TASK_FROM_PROJECT = gql`
  mutation DetachTaskFromProject($projectId: ID!, $taskId: ID!) {
    detachTaskFromProject(projectId: $projectId, taskId: $taskId)
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

export const ADVANCE_PROJECT_STAGE = gql`
  ${PROJECT_FIELDS}
  mutation AdvanceProjectStage(
    $projectId: ID!
    $toStage: ProjectStage!
    $note: String
    $expectedVersion: Int!
    $force: Boolean
  ) {
    advanceProjectStage(
      projectId: $projectId
      toStage: $toStage
      note: $note
      expectedVersion: $expectedVersion
      force: $force
    ) {
      ...ProjectFields
    }
  }
`;

export const REOPEN_PROJECT = gql`
  ${PROJECT_FIELDS}
  mutation ReopenProject($projectId: ID!, $expectedVersion: Int!) {
    reopenProject(projectId: $projectId, expectedVersion: $expectedVersion) {
      ...ProjectFields
    }
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
