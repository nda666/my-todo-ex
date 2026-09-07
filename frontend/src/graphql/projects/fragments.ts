import { gql } from "@apollo/client";

export const WORKFLOW_STEP_FIELDS = gql`
  fragment WorkflowStepFields on ProjectWorkflowStep {
    id
    projectId
    parentId
    title
    description
    divisiKode
    status
    sortOrder
    createdBy
    createdAt
    updatedAt
    children {
      id
      projectId
      parentId
      title
      description
      divisiKode
      status
      sortOrder
      createdBy
      createdAt
      updatedAt
      children {
        id
        projectId
        parentId
        title
        description
        divisiKode
        status
        sortOrder
        createdBy
        createdAt
        updatedAt
      }
    }
  }
`;

export const PROJECT_FIELDS = gql`
  ${WORKFLOW_STEP_FIELDS}
  fragment ProjectFields on Project {
    id
    name
    description
    ownerDivisiKode
    status
    stage
    stageVersion
    createdAt
    divisions
    leaders
    stageHistory {
      id
      fromStage
      toStage
      changedBy
      changedAt
      note
    }
    divisionProgress {
      divisiKode
      divisiNama
      totalTasks
      completedTasks
      percentDone
    }
    workflowSteps {
      ...WorkflowStepFields
    }
  }
`;

export const DIVISION_PROGRESS_FIELDS = gql`
  fragment DivisionProgressFields on DivisionProgress {
    divisiKode
    divisiNama
    totalTasks
    completedTasks
    percentDone
  }
`;
