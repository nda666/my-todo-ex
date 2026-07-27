import { gql } from "@apollo/client";
import { PROJECT_FIELDS, DIVISION_PROGRESS_FIELDS } from "./fragments";
import { TASK_FIELDS } from "../tasks/fragments";

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

export const GET_PROJECT_DIVISION_PROGRESS = gql`
  ${DIVISION_PROGRESS_FIELDS}
  query GetProjectDivisionProgress($projectId: ID!) {
    projectDivisionProgress(projectId: $projectId) {
      ...DivisionProgressFields
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
