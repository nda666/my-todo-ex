import { persistCache } from "apollo3-cache-persist";
import type { PersistentStorage } from "apollo3-cache-persist";

import {
  ApolloClient,
  ApolloLink,
  from,
  HttpLink,
  InMemoryCache,
} from "@apollo/client";
import { onError } from "@apollo/client/link/error";

import { clearToken, getToken } from "./auth";

export class IndexedDBWrapper implements PersistentStorage<string | null> {
  private dbName: string;
  private storeName: string;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(dbName = "apollo-cache-db", storeName = "apollo-cache") {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  private getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        if (typeof window === "undefined" || !window.indexedDB) {
          reject(new Error("IndexedDB is not supported in this environment"));
          return;
        }
        const request = window.indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.dbPromise;
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, "readonly");
        const store = tx.objectStore(this.storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve((req.result as string) ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string | null): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, "readwrite");
        const store = tx.objectStore(this.storeName);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // ignore
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, "readwrite");
        const store = tx.objectStore(this.storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // ignore
    }
  }
}

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
    Project: {
      keyFields: ["id"],
      fields: {
        stage: {
          merge(_existing, incoming) {
            return incoming;
          },
        },
        stageVersion: {
          merge(_existing, incoming) {
            return incoming;
          },
        },
        stageHistory: {
          merge(_existing, incoming) {
            return incoming;
          },
        },
      },
    },
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

// Persistent cache ke IndexedDB - saat reload halaman, data lama langsung muncul
// dari IndexedDB cache sebelum network response datang.
export async function initPersistedCache() {
  await persistCache({
    cache,
    storage: new IndexedDBWrapper(),
    maxSize: false,
  });
}
