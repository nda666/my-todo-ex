import { gql } from "@apollo/client";
import { USER_FIELDS } from "./fragments";

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
