import { ApolloCache } from '@apollo/client';
import { TASK_FIELDS } from '../graphql/tasks/fragments';

export interface TaskSubscriptionEvent {
  action: 'CREATED' | 'UPDATED' | 'DELETED' | string;
  task?: any;
  taskId?: string | null;
}

/**
 * Pushes real-time task updates directly into Apollo's normalized cache.
 * Eliminates full-page network refetches and round-trips.
 */
export function applyTaskEventToCache(
  cache: ApolloCache<any>,
  event: TaskSubscriptionEvent | null | undefined
) {
  if (!event) return;
  const { action, task, taskId } = event;

  if (action === 'CREATED' && task && task.id) {
    // 1. Write the created task as a normalized entity into Apollo Cache
    const taskRef = cache.writeFragment({
      data: {
        __typename: 'Task',
        ...task,
      },
      fragment: TASK_FIELDS,
      fragmentName: 'TaskFields',
    });

    if (!taskRef) return;

    // 2. Prepend the task reference into any cached tasks queries (TaskConnection)
    cache.modify({
      fields: {
        tasks(existingConnection, { readField }) {
          if (!existingConnection || !Array.isArray(existingConnection.tasks)) {
            return existingConnection;
          }

          const existingIds = new Set(
            existingConnection.tasks.map((itemRef: any) => readField('id', itemRef))
          );

          if (existingIds.has(task.id)) {
            return existingConnection;
          }

          return {
            ...existingConnection,
            tasks: [taskRef, ...existingConnection.tasks],
          };
        },
      },
    });
  } else if (action === 'UPDATED' && task && task.id) {
    // 1. Write the updated task into Apollo Cache directly
    // Because Apollo normalizes Task by id, any active query watching this task updates instantly!
    const taskRef = cache.writeFragment({
      data: {
        __typename: 'Task',
        ...task,
      },
      fragment: TASK_FIELDS,
      fragmentName: 'TaskFields',
    });

    // 2. If the task was not in a specific tasks connection before (e.g. reassigned to another user),
    // we can also ensure the connection contains it if appropriate
    if (taskRef) {
      cache.modify({
        fields: {
          tasks(existingConnection, { readField }) {
            if (!existingConnection || !Array.isArray(existingConnection.tasks)) {
              return existingConnection;
            }
            return {
              ...existingConnection,
              tasks: existingConnection.tasks.map((itemRef: any) => {
                if (readField('id', itemRef) === task.id) {
                  return taskRef;
                }
                return itemRef;
              }),
            };
          },
        },
      });
    }
  } else if (action === 'DELETED' && taskId) {
    // 1. Evict the task from Apollo Cache
    const identifiedId = cache.identify({ __typename: 'Task', id: taskId });
    if (identifiedId) {
      cache.evict({ id: identifiedId });
      cache.gc();
    }

    // 2. Remove the task reference from all cached task connections
    cache.modify({
      fields: {
        tasks(existingConnection, { readField }) {
          if (!existingConnection || !Array.isArray(existingConnection.tasks)) {
            return existingConnection;
          }
          return {
            ...existingConnection,
            tasks: existingConnection.tasks.filter(
              (itemRef: any) => readField('id', itemRef) !== taskId
            ),
          };
        },
      },
    });
  }
}
