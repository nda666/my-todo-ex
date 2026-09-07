// frontend/src/pages/Dashboard.tsx
import React, {
  useMemo,
  useState,
} from 'react';

import {
  Button,
  Card,
  Collapse,
  Empty,
  message,
  Segmented,
  Spin,
  Tooltip,
  Typography,
} from 'antd';

import {
  AppstoreOutlined,
  BranchesOutlined,
  CodeOutlined,
  PlusOutlined,
  SendOutlined,
  TableOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  useMutation,
  useQuery,
  useSubscription,
} from '@apollo/client';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import CreateTaskModal from '../components/CreateTaskModal';
import DragTaskPreview from '../components/DragTaskPreview';
import SortableTaskCard from '../components/SortableTaskCard';
import TaskSearchFilter from '../components/TaskSearchFilter';
import TaskStatusTabs from '../components/TaskStatusTabs';
import TaskTable from '../components/TaskTable';
import UpcomingTasksCard from '../components/UpcomingTasksCard';
import ProgrammerTemplateModal from '../components/ProgrammerTemplateModal';
import GitIntegrationModal from '../components/GitIntegrationModal';
import LiveTeamActivityStream from '../components/LiveTeamActivityStream';
import { useAuth } from '../contexts/AuthContext';
import { useInfiniteScrollSentinel } from '../hooks/useInfiniteScrollSentinel';
import { useInfiniteTasks } from '../hooks/useInfiniteTasks';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import DefaultLayout from '../layouts/DefaultLayout';
import {
  ADD_COMMENT,
  CREATE_TASK,
  DELETE_META,
  DELETE_TASK,
  GET_COLLEAGUES,
  GET_TEAM_OVERVIEW,
  REORDER_META,
  REORDER_TASKS,
  SET_META,
  TOGGLE_REACTION,
  UPDATE_TASK,
} from '../lib/queries';
import { TASK_EVENT_SUBSCRIPTION } from '../graphql/tasks';
import { applyTaskEventToCache } from '../lib/taskCacheUpdates';
import {
  Colleague,
  MetaDraft,
  Task,
  TaskStatus,
} from '../types/task';
import {
  countTasksByTab,
  filterTasksByTab,
  StatusTabKey,
} from '../utils/taskFilters';

const { Title, Text } = Typography

export default function Dashboard() {
  const { me } = useAuth()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [isGitModalOpen, setIsGitModalOpen] = useState(false)
  const [isActivityStreamOpen, setIsActivityStreamOpen] = useState(false)
  const [viewMode, setViewMode] = useLocalStorageState<'card' | 'table'>('task_view_mode', 'card')
  const [statusTab, setStatusTab] = useState<StatusTabKey>('all')
  const [assignmentTab, setAssignmentTab] = useState<'assignedToMe' | 'assignedToOthers' | 'all'>('assignedToMe')
  const [draggingTask, setDraggingTask] = useState<Task | null>(null)
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState<string | null>(null)
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const isLeader = me?.pegawai?.statusLeader === 1

  const taskFilters = useMemo(
    () => ({
      search: search.trim() || undefined,
      startDate: startDate || undefined,
      dueDate: dueDate || undefined,
      projectId: projectId || undefined,
    }),
    [search, startDate, dueDate, projectId]
  )

  const { tasks, loading, loadingMore, hasMore, loadMore, refetch } = useInfiniteTasks(null, taskFilters)
  const sentinelRef = useInfiniteScrollSentinel(loadMore, hasMore && !loading)

  const { data: colleaguesData } = useQuery(GET_COLLEAGUES, { pollInterval: 30000 })
  const colleagues: Colleague[] = colleaguesData?.colleagues || []
  const teamMembers = useMemo(() => colleagues.filter((c) => c.kodeku !== me?.kodeku), [colleagues, me?.kodeku])

  const { data: overviewData } = useQuery(GET_TEAM_OVERVIEW,
    { pollInterval: 30000 }
  )
  const teamTaskCounts = useMemo(() => {
    const counts: Record<string, number> = {}
      ; (overviewData?.tasks?.tasks || []).forEach((t: { userKode: string }) => {
        counts[t.userKode] = (counts[t.userKode] || 0) + 1
      })
    return counts
  }, [overviewData])

  const [createTaskMutation, { loading: creating }] = useMutation(CREATE_TASK, {
    update(cache, { data }) {
      if (data?.createTask) {
        applyTaskEventToCache(cache, {
          action: 'CREATED',
          task: data.createTask,
        })
      }
    },
  })

  const [deleteTaskMutation] = useMutation(DELETE_TASK, {
    update(cache, _, { variables }) {
      if (variables?.id) {
        applyTaskEventToCache(cache, {
          action: 'DELETED',
          taskId: String(variables.id),
        })
      }
    },
  })

  const [updateTaskMutation] = useMutation(UPDATE_TASK, {
    update(cache, { data }) {
      if (data?.updateTask) {
        applyTaskEventToCache(cache, {
          action: 'UPDATED',
          task: data.updateTask,
        })
      }
    },
  })

  useSubscription(TASK_EVENT_SUBSCRIPTION, {
    variables: { divisiKode: me?.pegawai?.kodedivisi || undefined },
    skip: !me,
    onData: ({ client, data }) => {
      applyTaskEventToCache(client.cache, data?.data?.taskEvent)
    },
  })
  const [addCommentMutation] = useMutation(ADD_COMMENT)
  const [toggleReactionMutation] = useMutation(TOGGLE_REACTION)
  const [setMetaMutation] = useMutation(SET_META)
  const [deleteMetaMutation] = useMutation(DELETE_META)
  const [reorderMetaMutation] = useMutation(REORDER_META)
  const [reorderTasksMutation] = useMutation(REORDER_TASKS)

  const handleCreate = async (values: {
    title: string
    description?: string
    meta: MetaDraft[]
    startDate?: string
    dueDate?: string
    projectId?: string | null
    subtasks?: string[]
  }) => {
    try {
      await createTaskMutation({
        variables: {
          input: {
            title: values.title.trim(),
            description: values.description?.trim() || null,
            meta: values.meta.filter((m) => m.key.trim()).map((m) => ({ key: m.key.trim(), value: m.value || null, type: m.type })),
            startDate: values.startDate || null,
            dueDate: values.dueDate || null,
            projectId: values.projectId || null,
            subtasks: values.subtasks || [],
          },
        },
      })
      setIsCreateModalOpen(false)
    } catch (err: any) {
      message.error(err.message || 'Gagal menambahkan task')
    }
  }



  const handleUpdate = async (
    id: string,
    input: {
      title?: string
      description?: string | null
      status?: TaskStatus
      priority?: string
      targetUserKode?: string
      meta?: Array<{ key: string; value?: string | null; type: MetaDraft['type'] }>
    }
  ) => {
    try {
      await updateTaskMutation({
        variables: { id, input },
      })
      message.success('Task berhasil diperbarui!')
    } catch (err: any) {
      message.error(err.message || 'Gagal memperbarui task')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteTaskMutation({ variables: { id } })
      message.success('Task berhasil dihapus!')
    } catch (err: any) {
      message.error(err.message || 'Gagal menghapus task')
    }
  }

  const handleAddComment = async (taskId: string, content: string, parentId?: string) => {
    try {
      await addCommentMutation({ variables: { taskId, content, parentId } })
      message.success('Komentar berhasil ditambahkan!')
    } catch (err: any) {
      message.error(err.message || 'Gagal menambahkan komentar')
    }
  }

  const handleToggleReaction = async (commentId: string, emoji: string) => {
    try {
      await toggleReactionMutation({ variables: { commentId, emoji } })
    } catch (err: any) {
      message.error(err.message || 'Gagal menambahkan reaksi')
    }
  }

  const handleSetMeta = async (taskId: string, key: string, value: string | null, type: MetaDraft['type']) => {
    try {
      const res = await setMetaMutation({ variables: { taskId, key, value, type } })
      return res.data?.setTaskMeta
    } catch (err: any) {
      message.error(err.message || 'Gagal memperbarui info tambahan')
      throw err
    }
  }

  const handleDeleteMeta = async (id: string) => {
    try {
      await deleteMetaMutation({ variables: { id } })
    } catch (err: any) {
      message.error(err.message || 'Gagal menghapus info tambahan')
      throw err
    }
  }

  const handleReorderMeta = (taskId: string, orderedIds: string[]) => {
    reorderMetaMutation({ variables: { taskId, orderedIds } }).catch((err) =>
      message.error(err.message || 'Gagal mengubah urutan info tambahan')
    )
  }

  const handleReassign = async (taskId: string, targetUserKode: string) => {
    if (!isLeader) {
      message.error('Hanya manager atau leader yang dapat mengubah penanggung jawab')
      return
    }
    try {
      await updateTaskMutation({
        variables: { id: taskId, input: { targetUserKode } },
      })
      message.success('Task berhasil dilimpahkan ulang!')
    } catch (err: any) {
      message.error(err.message || 'Gagal melimpahkan ulang task')
    }
  }

  const canManageTask = (task: Task) => task.userKode === me?.kodeku || task.createdBy === me?.kodeku || isLeader

  const assignmentFilteredTasks = useMemo(() => {
    if (assignmentTab === 'assignedToMe') {
      return tasks.filter((t) => t.userKode === me?.kodeku)
    }
    if (assignmentTab === 'assignedToOthers') {
      return tasks.filter((t) => t.createdBy === me?.kodeku && t.userKode !== me?.kodeku)
    }
    return tasks
  }, [tasks, assignmentTab, me?.kodeku])

  const assignedToMeCount = useMemo(() => tasks.filter((t) => t.userKode === me?.kodeku).length, [tasks, me?.kodeku])
  const assignedToOthersCount = useMemo(() => tasks.filter((t) => t.createdBy === me?.kodeku && t.userKode !== me?.kodeku).length, [tasks, me?.kodeku])

  const stats = {
    total: teamTaskCounts[me?.kodeku || ''] || 0,
    pending: tasks.filter((t) => t.userKode === me?.kodeku && t.status === 'PENDING').length,
    inProgress: tasks.filter((t) => t.userKode === me?.kodeku && t.status === 'IN_PROGRESS').length,
    completed: tasks.filter((t) => t.userKode === me?.kodeku && t.status === 'COMPLETED').length,
  }

  const filteredTasks = filterTasksByTab(assignmentFilteredTasks, statusTab)
  const counts = countTasksByTab(assignmentFilteredTasks)

  const isAllTab = statusTab === 'all'
  const activeTasks = isAllTab ? filteredTasks.filter((t) => t.status !== 'COMPLETED') : filteredTasks
  const completedTasksInAllTab = isAllTab ? filteredTasks.filter((t) => t.status === 'COMPLETED') : []

  const handleTaskDragStart = (event: DragStartEvent) => {
    setDraggingTask(activeTasks.find((t) => t.id === event.active.id) || null)
  }

  const handleTaskDragEnd = (event: DragEndEvent) => {
    setDraggingTask(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = activeTasks.findIndex((t) => t.id === active.id)
    const newIndex = activeTasks.findIndex((t) => t.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(activeTasks, oldIndex, newIndex)
    const orderedIds = reordered.map((t) => t.id)

    reorderTasksMutation({
      variables: { orderedIds },
      optimisticResponse: { reorderTasks: true },
      update(cache) {
        cache.modify({
          fields: {
            tasks(existing = { tasks: [], nextCursor: null, hasMore: false }) {
              const orderedRefs = orderedIds
                .map((id) => existing.tasks.find((ref: any) => ref.__ref === `Task:${id}`))
                .filter(Boolean)
              const remainingRefs = existing.tasks.filter(
                (ref: any) => !orderedIds.includes(ref.__ref?.replace('Task:', ''))
              )
              return { ...existing, tasks: [...orderedRefs, ...remainingRefs] }
            },
          },
        })
      },
    }).catch((err) => message.error(err.message || 'Gagal mengubah urutan task'))
  }

  return (
    <DefaultLayout
      title="Daftar Tugas Anda"
      teamMembers={teamMembers}
      teamTaskCounts={teamTaskCounts}
      stats={stats}
      onCreateTask={() => setIsCreateModalOpen(true)}
    >
      {loading ? (
        <div className="flex flex-col justify-center items-center py-20 gap-4 !bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-xl shadow-sm">
          <Spin size="large" />
          <Text type="secondary">Memuat daftar tugas...</Text>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4 px-1">
            <div>
              <Title level={5} className="!mb-0 font-semibold !text-slate-800 dark:!text-slate-200">Task Saya</Title>
              <Text className="text-xs !text-slate-500 dark:!text-slate-400">
                Perbarui status tugas, edit rincian, atau seret untuk mengubah urutan
              </Text>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Tooltip title="Quick Capture Task (Shortcut: Ctrl + K)">
                <Button
                  icon={<ThunderboltOutlined className="text-amber-500" />}
                  onClick={() => window.dispatchEvent(new CustomEvent('open-quick-capture'))}
                  className="rounded-lg"
                >
                  Quick Task
                </Button>
              </Tooltip>

              <Tooltip title="Muat template aktivitas harian divisi programmer">
                <Button
                  icon={<CodeOutlined className="text-blue-500" />}
                  onClick={() => setIsTemplateModalOpen(true)}
                  className="rounded-lg"
                >
                  Template Programmer
                </Button>
              </Tooltip>

              <Tooltip title="Setup Git Hook & Webhook untuk divisi programmer">
                <Button
                  icon={<BranchesOutlined className="text-violet-500" />}
                  onClick={() => setIsGitModalOpen(true)}
                  className="rounded-lg"
                >
                  Integrasi Git
                </Button>
              </Tooltip>

              {/* <Tooltip title="Pantau stream aktivitas langsung rekan satu divisi">
                <Button
                  icon={<TeamOutlined className="text-indigo-500" />}
                  onClick={() => setIsActivityStreamOpen(true)}
                  className="rounded-lg"
                >
                  Aktivitas Tim
                </Button>
              </Tooltip> */}

              <Segmented
                value={viewMode}
                onChange={(val) => setViewMode(val as 'card' | 'table')}
                options={[
                  { label: 'Card', value: 'card', icon: <AppstoreOutlined /> },
                  { label: 'Table', value: 'table', icon: <TableOutlined /> },
                ]}
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalOpen(true)} className="rounded-lg">
                Task Baru
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4 items-start">
            <UpcomingTasksCard tasks={tasks} />
            <LiveTeamActivityStream standalone />
          </div>

          <TaskSearchFilter
            search={search}
            onSearchChange={setSearch}
            startDate={startDate}
            dueDate={dueDate}
            onDateRangeChange={(s, d) => {
              setStartDate(s)
              setDueDate(d)
            }}
            projectId={projectId}
            onProjectIdChange={setProjectId}
            onReset={() => {
              setSearch('')
              setStartDate(null)
              setDueDate(null)
              setProjectId(null)
            }}
            loading={loading}
          />

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center gap-2 flex-wrap">
              <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400">Filter Penugasan:</Text>
              <Segmented
                value={assignmentTab}
                onChange={(val) => setAssignmentTab(val as 'assignedToMe' | 'assignedToOthers' | 'all')}
                options={[
                  { label: `Ditugaskan ke Saya (${assignedToMeCount})`, value: 'assignedToMe', icon: <UserOutlined /> },
                  { label: `Diberikan oleh Saya (${assignedToOthersCount})`, value: 'assignedToOthers', icon: <SendOutlined /> },
                  { label: `Semua Task Divisi (${tasks.length})`, value: 'all', icon: <TeamOutlined /> },
                ]}
              />
            </div>
          </div>

          <div className="mb-4">
            <TaskStatusTabs activeKey={statusTab} onChange={setStatusTab} counts={counts} />
          </div>

          {tasks.length === 0 ? (
            <Card className="!border !border-dashed !border-slate-300 dark:!border-slate-850 rounded-xl !bg-white dark:!bg-slate-900 text-center py-16 shadow-sm">
              <Empty
                description={<span className="!text-slate-500 dark:!text-slate-400 font-light">Belum ada task. Klik tombol <strong>Task Baru</strong> untuk memulainya!</span>}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </Card>
          ) : filteredTasks.length === 0 ? (
            <Card className="!border !border-dashed !border-slate-300 dark:!border-slate-850 rounded-xl !bg-white dark:!bg-slate-900 text-center py-12 shadow-sm">
              <Empty description={<span className="!text-slate-500 dark:!text-slate-400 font-light">Tidak ada task di tab ini.</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </Card>
          ) : viewMode === 'table' ? (
            <>
              <TaskTable
                tasks={filteredTasks}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onAddComment={handleAddComment}
                onToggleReaction={handleToggleReaction}
                onSetMeta={handleSetMeta}
                onDeleteMeta={handleDeleteMeta}
                onReorderMeta={handleReorderMeta}
                onReassign={isLeader ? handleReassign : undefined}
                members={colleagues}
                onReorderTasks={(orderedIds) =>
                  reorderTasksMutation({ variables: { orderedIds } })
                    .catch((err) => message.error(err.message || 'Gagal mengubah urutan task'))
                }
                isRowEditable={canManageTask}
              />
              <div ref={sentinelRef} />
              {loadingMore && <div className="text-center py-4"><Spin /></div>}
            </>
          ) : (
            <div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleTaskDragStart}
                onDragEnd={handleTaskDragEnd}
                onDragCancel={() => setDraggingTask(null)}
              >
                <SortableContext items={activeTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {activeTasks.map((task) => (
                    <SortableTaskCard
                      key={task.id}
                      task={task}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      onAddComment={handleAddComment}
                      onToggleReaction={handleToggleReaction}
                      onSetMeta={handleSetMeta}
                      onDeleteMeta={handleDeleteMeta}
                      onReorderMeta={handleReorderMeta}
                      onReassign={isLeader ? handleReassign : undefined}
                      members={colleagues}
                      readOnly={!canManageTask(task)}
                    />
                  ))}
                </SortableContext>
                <DragOverlay>{draggingTask && <DragTaskPreview task={draggingTask} />}</DragOverlay>
              </DndContext>

              {isAllTab && completedTasksInAllTab.length > 0 && (
                <Collapse
                  className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-xl"
                  items={[
                    {
                      key: 'completed',
                      label: (
                        <span className="text-sm font-medium !text-slate-600 dark:!text-slate-300">
                          Selesai ({completedTasksInAllTab.length})
                        </span>
                      ),
                      children: (
                        <div className="pt-2">
                          {completedTasksInAllTab.map((task) => (
                            <SortableTaskCard
                              key={task.id}
                              task={task}
                              onUpdate={handleUpdate}
                              onDelete={handleDelete}
                              onAddComment={handleAddComment}
                              onToggleReaction={handleToggleReaction}
                              onSetMeta={handleSetMeta}
                              onDeleteMeta={handleDeleteMeta}
                              onReorderMeta={handleReorderMeta}
                              onReassign={isLeader ? handleReassign : undefined}
                              members={colleagues}
                              readOnly={!canManageTask(task)}
                            />
                          ))}
                        </div>
                      ),
                    },
                  ]}
                />
              )}

              <div ref={sentinelRef} />
              {loadingMore && <div className="text-center py-4"><Spin /></div>}
            </div>
          )}
        </>
      )}

      <CreateTaskModal
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        onCreate={handleCreate}
        loading={creating}
      />


      <ProgrammerTemplateModal
        open={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
      />

      <GitIntegrationModal
        open={isGitModalOpen}
        onClose={() => setIsGitModalOpen(false)}
      />

      <LiveTeamActivityStream
        open={isActivityStreamOpen}
        onClose={() => setIsActivityStreamOpen(false)}
      />
    </DefaultLayout>
  )
}