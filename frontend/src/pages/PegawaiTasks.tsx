// frontend/src/pages/PegawaiTasks.tsx
import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  Card,
  Collapse,
  Empty,
  Layout,
  Segmented,
  Spin,
  Typography,
} from 'antd';
import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import {
  AppstoreOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { useMutation } from '@apollo/client';
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

import DragTaskPreview from '../components/DragTaskPreview';
import SortableTaskCard from '../components/SortableTaskCard';
import TaskSearchFilter from '../components/TaskSearchFilter';
import TaskStatusTabs from '../components/TaskStatusTabs';
import TaskTable from '../components/TaskTable';
import { useAuth } from '../contexts/AuthContext';
import { useInfiniteScrollSentinel } from '../hooks/useInfiniteScrollSentinel';
import { useInfiniteTasks } from '../hooks/useInfiniteTasks';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import { useTeamHeader } from '../layouts/TeamLayout';
import { CloudinaryUploadResult } from '../lib/cloudinary';
import {
  ADD_COMMENT,
  DELETE_META,
  DELETE_TASK,
  REORDER_META,
  REORDER_TASKS,
  SET_META,
  TOGGLE_REACTION,
  UPDATE_TASK,
} from '../lib/queries';
import {
  MetaDraft,
  Task,
} from '../types/task';
import {
  countTasksByTab,
  filterTasksByTab,
  StatusTabKey,
} from '../utils/taskFilters';

const { Header, Content } = Layout
const { Title, Text } = Typography

export default function PegawaiTasks() {
    const { me, logout } = useAuth()
    const navigate = useNavigate()
    const { divisiId, pegawaiId } = useParams<{ divisiId: string; pegawaiId: string }>()
    const [viewMode, setViewMode] = useLocalStorageState<'card' | 'table'>('task_view_mode', 'card')
    const [statusTab, setStatusTab] = useState<StatusTabKey>('all')
    const [draggingTask, setDraggingTask] = useState<Task | null>(null)
    const [search, setSearch] = useState('')
    const [startDate, setStartDate] = useState<string | null>(null)
    const [dueDate, setDueDate] = useState<string | null>(null)
    const [projectId, setProjectId] = useState<string | null>(null)

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

    const handleBack = useCallback(() => navigate(`/teams/${divisiId}`), [navigate, divisiId])
    const isOwnPage = pegawaiId === me?.kodeku

    const taskFilters = useMemo(
        () => ({
            search: search.trim() || undefined,
            startDate: startDate || undefined,
            dueDate: dueDate || undefined,
            projectId: projectId || undefined,
        }),
        [search, startDate, dueDate, projectId]
    )

    const { tasks, loading, loadingMore, hasMore, loadMore } = useInfiniteTasks(pegawaiId || null, taskFilters)
    const sentinelRef = useInfiniteScrollSentinel(loadMore, hasMore && !loading)

    const [updateTaskMutation] = useMutation(UPDATE_TASK)
    const [deleteTaskMutation] = useMutation(DELETE_TASK)
    const [addCommentMutation] = useMutation(ADD_COMMENT)
    const [toggleReactionMutation] = useMutation(TOGGLE_REACTION)
    const [setMetaMutation] = useMutation(SET_META)
    const [deleteMetaMutation] = useMutation(DELETE_META)
    const [reorderMetaMutation] = useMutation(REORDER_META)
    const [reorderTasksMutation] = useMutation(REORDER_TASKS)

    const handleUpdate = async (id: string, input: any) => {
        await updateTaskMutation({ variables: { id, input } })
        loadMore()
    }
    const handleDelete = async (id: string) => {
        await deleteTaskMutation({ variables: { id } })
        loadMore()
    }
    const handleAddComment = async (taskId: string, content: string, parentId: string | null, attachments: CloudinaryUploadResult[]) => {
        await addCommentMutation({ variables: { taskId, content, parentId, attachments } })
        loadMore()
    }
    const handleToggleReaction = async (commentId: string, emoji: string) => {
        await toggleReactionMutation({ variables: { commentId, emoji } })
        loadMore()
    }
    const handleSetMeta = async (taskId: string, key: string, value: string | null, type: MetaDraft['type']) => {
        const { data } = await setMetaMutation({ variables: { taskId, key, value, type } })
        loadMore()
        return data?.setTaskMeta
    }
    const handleDeleteMeta = async (id: string) => {
        await deleteMetaMutation({ variables: { id } })
        loadMore()
    }
    const handleReorderMeta = async (taskId: string, orderedIds: string[]) => {
        await reorderMetaMutation({ variables: { taskId, orderedIds } })
        loadMore()
    }

    const canManageTask = useCallback(
        (task: Task) => task.userKode === me?.kodeku || task.createdBy === me?.kodeku,
        [me?.kodeku]
    )

    const filteredTasks = filterTasksByTab(tasks, statusTab)
    const counts = countTasksByTab(tasks)

    const isAllTab = statusTab === 'all'
    const activeTasks = isAllTab ? filteredTasks.filter((t) => t.status !== 'COMPLETED') : filteredTasks
    const completedTasksInAllTab = isAllTab ? filteredTasks.filter((t) => t.status === 'COMPLETED') : []

    const handleTaskDragStart = (event: DragStartEvent) => {
        if (!isOwnPage) return
        setDraggingTask(activeTasks.find((t) => t.id === event.active.id) || null)
    }

    const handleTaskDragEnd = (event: DragEndEvent) => {
        setDraggingTask(null)
        if (!isOwnPage) return
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIndex = activeTasks.findIndex((t) => t.id === active.id)
        const newIndex = activeTasks.findIndex((t) => t.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return

        const orderedIds = arrayMove(activeTasks, oldIndex, newIndex).map((t) => t.id)
        reorderTasksMutation({ variables: { orderedIds } })
            .then(() => loadMore())
            .catch(() => { })
    }

    useTeamHeader({ title: isOwnPage ? 'Task Saya' : 'Task Pegawai', onBack: handleBack })
    return (
        <>
            {loading ? (
                <div className="flex flex-col justify-center items-center py-20 gap-4 !bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-xl shadow-sm">
                    <Spin size="large" />
                    <Text type="secondary">Memuat daftar tugas...</Text>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between mb-4 px-1">
                        <Text className="text-xs !text-slate-500 dark:!text-slate-400">
                            {isOwnPage ? 'Perbarui status tugas, edit rincian, atau seret untuk mengubah urutan' : 'Task yang Anda buatkan bisa diedit, sisanya hanya bisa dilihat'}
                        </Text>
                        <Segmented
                            value={viewMode}
                            onChange={(val) => setViewMode(val as 'card' | 'table')}
                            options={[
                                { label: 'Card', value: 'card', icon: <AppstoreOutlined /> },
                                { label: 'Table', value: 'table', icon: <TableOutlined /> },
                            ]}
                        />
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

                    <div className="mb-4">
                        <TaskStatusTabs activeKey={statusTab} onChange={setStatusTab} counts={counts} />
                    </div>

                    {tasks.length === 0 ? (
                        <Card className="!border !border-dashed !border-slate-300 dark:!border-slate-850 rounded-xl !bg-white dark:!bg-slate-900 text-center py-16 shadow-sm">
                            <Empty description={<span className="!text-slate-500 dark:!text-slate-400 font-light">Belum ada task.</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
                                onReorderTasks={isOwnPage ? (orderedIds) =>
                                    reorderTasksMutation({ variables: { orderedIds } }).then(() => loadMore()).catch(() => { })
                                    : undefined}
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
        </>
    )
}