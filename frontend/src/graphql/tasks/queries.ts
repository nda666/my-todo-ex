import { gql } from "@apollo/client";
import { TASK_FIELDS } from "./fragments";

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
