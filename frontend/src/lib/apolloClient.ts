import { LocalStorageWrapper, persistCache } from "apollo3-cache-persist";

import {
  ApolloClient,
  ApolloLink,
  from,
  HttpLink,
  InMemoryCache,
} from "@apollo/client";
import { onError } from "@apollo/client/link/error";

import { clearToken, getToken } from "./auth";

const httpLink = new HttpLink({ uri: "/query" });

const authLink = new ApolloLink((operation, forward) => {
  const token = getToken();
  operation.setContext({
    headers: { authorization: token ? `Bearer ${token}` : "" },
  });
  return forward(operation);
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors?.some((e) => e.message === "unauthorized")) {
    clearToken();
    window.location.href = "/login";
  }
  if (networkError) {
    console.error("Network error:", networkError);
  }
});

// Cache dikonfigurasi dengan normalisasi per-entity (id-based) supaya hasil mutation
// otomatis "nempel" ke semua query yang sedang menampilkan entity yang sama - ini yang
// menghilangkan kebutuhan refetch manual/full-page-reload tiap kali ada perubahan.
export const cache = new InMemoryCache({
  typePolicies: {
    Task: { keyFields: ["id"] },
    TaskComment: { keyFields: ["id"] },
    TaskMeta: { keyFields: ["id"] },
    Project: { keyFields: ["id"] },
    Colleague: { keyFields: ["kodeku"] },
  },
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache,
  defaultOptions: {
    watchQuery: { fetchPolicy: "cache-and-network" }, // tampilkan cache dulu (instan), lalu update diam-diam di background
    query: { fetchPolicy: "cache-first" },
  },
  devtools: {
    enabled: import.meta.env.DEV,
  },
});

// Persistent cache ke localStorage - saat reload halaman, data lama langsung muncul
// dari cache sebelum network response datang (perceived performance jauh lebih cepat).
export async function initPersistedCache() {
  await persistCache({
    cache,
    storage: new LocalStorageWrapper(window.localStorage),
    maxSize: 5 * 1024 * 1024, // 5MB
  });
}
