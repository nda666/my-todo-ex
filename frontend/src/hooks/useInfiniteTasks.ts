import { useCallback } from 'react';

import { useQuery } from '@apollo/client';

import { GET_TASKS } from '../lib/queries';
import { Task } from '../types/task';

const PAGE_SIZE = 20;

export interface TaskFilters {
  search?: string;
  startDate?: string;
  dueDate?: string;
  projectId?: string | null;
}

export function useInfiniteTasks(
  userKode?: string | null,
  filters?: TaskFilters,
) {
  const queryVariables = {
    limit: PAGE_SIZE,
    cursor: null,
    userKode: userKode || null,
    search: filters?.search || null,
    startDate: filters?.startDate || null,
    dueDate: filters?.dueDate || null,
    projectId: filters?.projectId || null,
  };

  const { data, loading, fetchMore, networkStatus } = useQuery(GET_TASKS, {
    variables: queryVariables,
    notifyOnNetworkStatusChange: true,
    skip: userKode === undefined,
  });

  const tasks: Task[] = data?.tasks?.tasks || [];
  const hasMore: boolean = data?.tasks?.hasMore || false;
  const nextCursor: string | null = data?.tasks?.nextCursor || null;
  const loadingMore = networkStatus === 3; // fetchMore in-flight

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || !nextCursor) return;
    fetchMore({
      variables: {
        ...queryVariables,
        cursor: nextCursor,
      },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult) return prev;
        return {
          tasks: {
            ...fetchMoreResult.tasks,
            tasks: [...prev.tasks.tasks, ...fetchMoreResult.tasks.tasks],
          },
        };
      },
    });
  }, [hasMore, loadingMore, nextCursor, queryVariables, fetchMore]);

  return { tasks, loading: loading && !data, loadingMore, hasMore, loadMore };
}
