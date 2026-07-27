import { gql } from "@apollo/client";
import { USER_FIELDS } from "./fragments";

export const ME = gql`
  ${USER_FIELDS}
  query Me {
    me {
      ...UserFields
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
