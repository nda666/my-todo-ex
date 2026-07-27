import { gql } from "@apollo/client";

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
