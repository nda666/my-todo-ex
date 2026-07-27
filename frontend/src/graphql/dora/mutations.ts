import { gql } from "@apollo/client";

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
