// frontend/src/pages/ProjectDetail.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Button,
  Collapse,
  Empty,
  message,
  Segmented,
  Select,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import {
  AppstoreOutlined,
  CrownFilled,
  PlusOutlined,
  TableOutlined,
} from '@ant-design/icons';
import {
  useApolloClient,
  useMutation,
  useQuery,
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
import TaskTable from '../components/TaskTable';
import { useAuth } from '../contexts/AuthContext';
import { useTeamHeader } from '../layouts/TeamLayout';
import {
  ADD_COMMENT,
  ADD_PROJECT_LEADER,
  CREATE_PROJECT_TASK,
  DELETE_META,
  DELETE_TASK,
  GET_COLLEAGUES_BY_DIVISI,
  GET_DIVISIONS,
  GET_PROJECT,
  GET_PROJECT_TASKS,
  INVITE_DIVISION,
  REMOVE_DIVISION,
  REMOVE_PROJECT_LEADER,
  REORDER_META,
  REORDER_TASKS,
  SET_META,
  TOGGLE_REACTION,
  UPDATE_TASK,
} from '../lib/queries';
import {
  Colleague,
  Task,
} from '../types/task';

const { Title, Text } = Typography

export default function ProjectDetail() {
    const { me } = useAuth()
    const navigate = useNavigate()
    const { projectId } = useParams<{ projectId: string }>()
    const client = useApolloClient()
    const [draggingTask, setDraggingTask] = useState<Task | null>(null)
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

    const [divisionMembers, setDivisionMembers] = useState<Record<number, Colleague[]>>({})
    const [viewMode, setViewMode] = useState<'card' | 'table'>('card')
    const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)
    const [inviteTarget, setInviteTarget] = useState<number | null>(null)

    // --- Baca data reaktif ---
    const { data: projectData, loading: projectLoading } = useQuery(GET_PROJECT, {
        variables: { id: projectId },
        skip: !projectId,
    })
    const project = projectData?.project

    const { data: tasksData, loading: tasksLoading, refetch: refetchProjectTasks } = useQuery(GET_PROJECT_TASKS, {
        variables: { projectId, limit: 50 },
        skip: !projectId,
        pollInterval: 15000,
    })
    const tasks: Task[] = tasksData?.projectTasks?.tasks || []

    const { data: divisionsData } = useQuery(GET_DIVISIONS)
    const divisions = divisionsData?.divisions || []

    useEffect(() => {
        if (!project?.divisions) return
        const load = async () => {
            const entries = await Promise.all(
                (project.divisions as number[]).map(async (kode: number) => {
                    const { data } = await client.query({ query: GET_COLLEAGUES_BY_DIVISI, variables: { divisiKode: kode } })
                    return [kode, data.colleaguesByDivisi as Colleague[]] as const
                })
            )
            setDivisionMembers(Object.fromEntries(entries))
        }
        load()
    }, [project?.divisions, client])

    const isProjectLeader = project?.leaders.includes(me?.kodeku || '') || false
    const isDivisionLeader = me?.pegawai?.statusLeader === 1
    const canManage = isProjectLeader || (isDivisionLeader && project?.ownerDivisiKode === me?.pegawai?.divisi?.kode)

    const divisionName = (kode: number) => divisions.find((d: any) => d.kode === kode)?.nama || `Divisi ${kode}`
    const nonJoinedDivisions = divisions.filter((d: any) => !project?.divisions.includes(d.kode))
    const allMembers = useMemo(() => Object.values(divisionMembers).flat(), [divisionMembers])

    const [inviteDivision] = useMutation(INVITE_DIVISION)
    const [removeDivision] = useMutation(REMOVE_DIVISION)
    const [addProjectLeader] = useMutation(ADD_PROJECT_LEADER)
    const [removeProjectLeader] = useMutation(REMOVE_PROJECT_LEADER)
    const [createProjectTask, { loading: creatingTask }] = useMutation(CREATE_PROJECT_TASK)
    const [updateTaskMutation] = useMutation(UPDATE_TASK)
    const [deleteTaskMutation] = useMutation(DELETE_TASK)
    const [addCommentMutation] = useMutation(ADD_COMMENT)
    const [toggleReactionMutation] = useMutation(TOGGLE_REACTION)
    const [setMetaMutation] = useMutation(SET_META)
    const [deleteMetaMutation] = useMutation(DELETE_META)
    const [reorderMetaMutation] = useMutation(REORDER_META)
    const [reorderTasksMutation] = useMutation(REORDER_TASKS)

    const handleInvite = () => {
        if (!inviteTarget || !projectId) return
        inviteDivision({
            variables: { projectId, divisiKode: inviteTarget },
            optimisticResponse: { inviteDivisionToProject: true },
            update(cache) {
                const existing = cache.readQuery<{ project: any }>({ query: GET_PROJECT, variables: { id: projectId } })
                if (!existing) return
                cache.writeQuery({
                    query: GET_PROJECT,
                    variables: { id: projectId },
                    data: { project: { ...existing.project, divisions: [...existing.project.divisions, inviteTarget] } },
                })
            },
        })
            .then(() => setInviteTarget(null))
            .catch((err) => message.error(err.message || 'Gagal mengundang divisi'))
    }

    const handleRemoveDivision = (divisiKode: number) => {
        if (!projectId) return
        removeDivision({
            variables: { projectId, divisiKode },
            optimisticResponse: { removeDivisionFromProject: true },
            update(cache) {
                const existing = cache.readQuery<{ project: any }>({ query: GET_PROJECT, variables: { id: projectId } })
                if (!existing) return
                cache.writeQuery({
                    query: GET_PROJECT,
                    variables: { id: projectId },
                    data: { project: { ...existing.project, divisions: existing.project.divisions.filter((d: number) => d !== divisiKode) } },
                })
            },
        }).catch((err) => message.error(err.message || 'Gagal mengeluarkan divisi'))
    }

    const handleAddLeader = (pegawaiKode: string) => {
        if (!projectId) return
        addProjectLeader({
            variables: { projectId, pegawaiKode },
            optimisticResponse: { addProjectLeader: true },
            update(cache) {
                const existing = cache.readQuery<{ project: any }>({ query: GET_PROJECT, variables: { id: projectId } })
                if (!existing) return
                cache.writeQuery({
                    query: GET_PROJECT,
                    variables: { id: projectId },
                    data: { project: { ...existing.project, leaders: [...existing.project.leaders, pegawaiKode] } },
                })
            },
        }).catch((err) => message.error(err.message || 'Gagal menambah project leader'))
    }

    const handleRemoveLeader = (pegawaiKode: string) => {
        if (!projectId) return
        removeProjectLeader({
            variables: { projectId, pegawaiKode },
            optimisticResponse: { removeProjectLeader: true },
            update(cache) {
                const existing = cache.readQuery<{ project: any }>({ query: GET_PROJECT, variables: { id: projectId } })
                if (!existing) return
                cache.writeQuery({
                    query: GET_PROJECT,
                    variables: { id: projectId },
                    data: { project: { ...existing.project, leaders: existing.project.leaders.filter((k: string) => k !== pegawaiKode) } },
                })
            },
        }).catch((err) => message.error(err.message || 'Gagal menghapus project leader'))
    }

    const handleCreateTask = async (values: { title: string; description?: string; targetUserKode?: string; startDate?: string; dueDate?: string; projectId?: string | null }) => {
        const targetProjId = values.projectId !== undefined ? values.projectId : projectId
        if (targetProjId) {
            try {
                await createProjectTask({
                    variables: {
                        projectId: targetProjId,
                        title: values.title,
                        description: values.description || null,
                        targetUserKode: values.targetUserKode || null,
                        startDate: values.startDate || null,
                        dueDate: values.dueDate || null,
                    },
                    update(cache, { data }) {
                        cache.modify({
                            fields: {
                                projectTasks(existing = { tasks: [], nextCursor: null, hasMore: false }) {
                                    return { ...existing, tasks: [{ __ref: cache.identify(data.createProjectTask) }, ...existing.tasks] }
                                },
                            },
                        })
                    },
                })
                setIsCreateTaskOpen(false)
            } catch (err: any) {
                message.error(err.message || 'Gagal membuat task')
            }
        }
    }

    const handleUpdate = (id: string, input: any) => {
        updateTaskMutation({
            variables: { id, input },
            optimisticResponse: { updateTask: { __typename: 'Task', id, ...input, updatedAt: new Date().toISOString() } },
        }).catch((err) => message.error(err.message || 'Gagal memperbarui task'))
    }

    const handleDelete = async (id: string) => {
        try {
            await deleteTaskMutation({
                variables: { id },
                update(cache) {
                    cache.evict({ id: cache.identify({ __typename: 'Task', id }) })
                    cache.gc()
                },
            })
        } catch (err: any) {
            message.error(err.message || 'Gagal menghapus task')
        }
    }

    const handleAddComment = async (taskId: string, content: string, parentId: string | null, attachments: any[]) => {
        try {
            await addCommentMutation({ variables: { taskId, content, parentId, attachments } })
        } catch (err: any) {
            message.error(err.message || 'Gagal menambahkan komentar')
        }
    }

    const handleToggleReaction = (commentId: string, emoji: string) => {
        toggleReactionMutation({ variables: { commentId, emoji } }).catch((err) => message.error(err.message || 'Gagal memberi reaksi'))
    }

    const handleSetMeta = async (taskId: string, key: string, value: string | null, type: any) => {
        const { data } = await setMetaMutation({ variables: { taskId, key, value, type } })
        return data.setTaskMeta
    }

    const handleDeleteMeta = async (id: string) => {
        await deleteMetaMutation({ variables: { id } })
    }

    const handleReorderMeta = (taskId: string, orderedIds: string[]) => {
        reorderMetaMutation({ variables: { taskId, orderedIds } }).catch((err) => message.error(err.message || 'Gagal mengubah urutan'))
    }

    const canManageTask = (task: any) => task.userKode === me?.kodeku || task.createdBy === me?.kodeku

    const activeTasks = tasks.filter((t) => t.status !== 'COMPLETED')
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED')

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

        const orderedIds = arrayMove(activeTasks, oldIndex, newIndex).map((t) => t.id)
        reorderTasksMutation({ variables: { orderedIds } })
            .then(() => refetchProjectTasks())
            .catch((err) => message.error(err.message || 'Gagal mengubah urutan task'))
    }

    const handleBack = useCallback(() => navigate('/projects'), [navigate])
    const headerExtra = useMemo(() => (
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateTaskOpen(true)}>
            Buat Task
        </Button>
    ), [])
    useTeamHeader({ title: project?.name || 'Project', onBack: handleBack, headerExtra: project ? headerExtra : undefined })

    if (projectLoading || !project) {
        return <div className="flex justify-center py-20"><Spin size="large" /></div>
    }

    return (
        < >
            <div className="flex flex-col gap-6">
                {project.description && (
                    <Text className="text-sm !text-slate-500 dark:!text-slate-400">{project.description}</Text>
                )}

                <div className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-xl p-4">
                    <Title level={5} className="!mb-3 !text-slate-800 dark:!text-slate-200">Divisi Tergabung</Title>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {project.divisions.map((kode: number) => (
                            <Tag
                                key={kode}
                                closable={canManage && kode !== project.ownerDivisiKode}
                                onClose={(e) => { e.preventDefault(); handleRemoveDivision(kode) }}
                                color={kode === project.ownerDivisiKode ? 'blue' : 'default'}
                            >
                                {divisionName(kode)} {kode === project.ownerDivisiKode && '(Pemilik)'}
                            </Tag>
                        ))}
                    </div>
                    {canManage && nonJoinedDivisions.length > 0 && (
                        <div className="flex gap-2">
                            <Select
                                placeholder="Pilih divisi untuk diundang..."
                                className="w-64"
                                value={inviteTarget}
                                onChange={setInviteTarget}
                                options={nonJoinedDivisions.map((d: any) => ({ value: d.kode, label: d.nama }))}
                            />
                            <Button type="primary" disabled={!inviteTarget} onClick={handleInvite}>Undang</Button>
                        </div>
                    )}
                </div>

                <div className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-xl p-4">
                    <Title level={5} className="!mb-3 !text-slate-800 dark:!text-slate-200">Project Leader</Title>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {project.leaders.map((kode: string) => {
                            const member = allMembers.find((m) => m.kodeku === kode)
                            return (
                                <Tag
                                    key={kode}
                                    icon={<CrownFilled />}
                                    color="gold"
                                    closable={isProjectLeader && project.leaders.length > 1}
                                    onClose={(e) => { e.preventDefault(); handleRemoveLeader(kode) }}
                                >
                                    {member?.nama || kode}
                                </Tag>
                            )
                        })}
                    </div>
                    {isProjectLeader && (
                        <Select
                            placeholder="Tambah project leader dari anggota project..."
                            className="w-72"
                            onChange={handleAddLeader}
                            value={null}
                            options={allMembers
                                .filter((m) => !project.leaders.includes(m.kodeku))
                                .map((m) => ({ value: m.kodeku, label: m.nama }))}
                        />
                    )}
                </div>

                <div>
                    <div className="flex items-center justify-between mb-3">
                        <Title level={5} className="!mb-0 !text-slate-800 dark:!text-slate-200">Task Project</Title>
                        <Segmented
                            value={viewMode}
                            onChange={(v) => setViewMode(v as 'card' | 'table')}
                            options={[
                                { label: 'Card', value: 'card', icon: <AppstoreOutlined /> },
                                { label: 'Table', value: 'table', icon: <TableOutlined /> },
                            ]}
                        />
                    </div>

                    {tasksLoading && !tasksData ? (
                        <div className="flex justify-center py-12"><Spin /></div>
                    ) : tasks.length === 0 ? (
                        <div className="!bg-white dark:!bg-slate-900 !border !border-dashed !border-slate-300 dark:!border-slate-800 rounded-xl py-12">
                            <Empty description={<span className="!text-slate-500 dark:!text-slate-400">Belum ada task di project ini.</span>} />
                        </div>
                    ) : viewMode === 'table' ? (
                        <TaskTable
                            tasks={tasks}
                            onUpdate={handleUpdate}
                            onDelete={handleDelete}
                            onAddComment={handleAddComment}
                            onToggleReaction={handleToggleReaction}
                            onSetMeta={handleSetMeta}
                            onDeleteMeta={handleDeleteMeta}
                            onReorderMeta={handleReorderMeta}
                            onReorderTasks={(orderedIds) =>
                                reorderTasksMutation({ variables: { orderedIds } })
                                    .then(() => refetchProjectTasks())
                                    .catch((err) => message.error(err.message || 'Gagal mengubah urutan task'))
                            }
                            isRowEditable={canManageTask}
                        />
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

                            {completedTasks.length > 0 && (
                                <Collapse
                                    className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-xl"
                                    items={[
                                        {
                                            key: 'completed',
                                            label: (
                                                <span className="text-sm font-medium !text-slate-600 dark:!text-slate-300">
                                                    Selesai ({completedTasks.length})
                                                </span>
                                            ),
                                            children: (
                                                <div className="pt-2">
                                                    {completedTasks.map((task) => (
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
                        </div>
                    )}
                </div>
            </div>

            <CreateTaskModal
                open={isCreateTaskOpen}
                onCancel={() => setIsCreateTaskOpen(false)}
                onCreate={handleCreateTask}
                loading={creatingTask}
                initialProjectId={projectId}
            />
        </>
    )
}