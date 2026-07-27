import { gql } from "@apollo/client";

export const PROJECT_FIELDS = gql`
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
