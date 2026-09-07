import { gql } from '@apollo/client';
import { TASK_FIELDS } from './fragments';

export const TASK_EVENT_SUBSCRIPTION = gql`
  ${TASK_FIELDS}
  subscription OnTaskEvent($divisiKode: Int) {
    taskEvent(divisiKode: $divisiKode) {
      action
      taskId
      task {
        ...TaskFields
      }
    }
  }
`;

export const TASK_UPDATED_SUBSCRIPTION = gql`
  ${TASK_FIELDS}
  subscription OnTaskUpdated($divisiKode: Int) {
    taskUpdated(divisiKode: $divisiKode) {
      ...TaskFields
    }
  }
`;
