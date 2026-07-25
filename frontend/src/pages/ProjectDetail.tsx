// frontend/src/pages/ProjectDetail.tsx
import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';

import {
    Alert,
    Badge,
    Button,
    Card,
    Collapse,
    Empty,
    Input,
    message,
    Modal,
    Progress,
    Segmented,
    Select,
    Spin,
    Steps,
    Table,
    Tag,
    Timeline,
    Typography,
} from 'antd';
import {
    useNavigate,
    useParams,
} from 'react-router-dom';

import {
    AppstoreOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
    CrownFilled,
    DownloadOutlined,
    ExclamationCircleOutlined,
    PauseCircleOutlined,
    PlusOutlined,
    PlayCircleOutlined,
    RedoOutlined,
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
    ADVANCE_PROJECT_STAGE,
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
    REOPEN_PROJECT,
    REORDER_META,
    REORDER_TASKS,
    SET_META,
    TOGGLE_REACTION,
    UPDATE_TASK,
} from '../lib/queries';
import { ProjectStage } from '../types/project';
import {
    Colleague,
    Task,
} from '../types/task';

const { Title, Text, Paragraph } = Typography;

const PRIMARY_STAGES: ProjectStage[] = ['PLANNING', 'IN_PROGRESS', 'REVIEW', 'DONE'];

const STAGE_LABELS: Record<ProjectStage, string> = {
    PLANNING: 'Planning',
    IN_PROGRESS: 'In Progress',
    REVIEW: 'Review',
    REJECTED: 'Rejected',
    ON_HOLD: 'On Hold',
    CANCELLED: 'Cancelled',
    DONE: 'Done',
};

const STAGE_COLORS: Record<ProjectStage, string> = {
    PLANNING: 'blue',
    IN_PROGRESS: 'processing',
    REVIEW: 'warning',
    REJECTED: 'error',
    ON_HOLD: 'default',
    CANCELLED: 'volcano',
    DONE: 'success',
};

export default function ProjectDetail() {
    const { me } = useAuth();
    const navigate = useNavigate();
    const { projectId } = useParams<{ projectId: string }>();
    const client = useApolloClient();
    const [draggingTask, setDraggingTask] = useState<Task | null>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const [divisionMembers, setDivisionMembers] = useState<Record<number, Colleague[]>>({});
    const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
    const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
    const [inviteTarget, setInviteTarget] = useState<number | null>(null);
    const [downloadingReport, setDownloadingReport] = useState(false);

    // Stage transition modal
    const [transitionModalVisible, setTransitionModalVisible] = useState(false);
    const [targetStage, setTargetStage] = useState<ProjectStage | null>(null);
    const [transitionNote, setTransitionNote] = useState('');
    const [forceTransition, setForceTransition] = useState(false);

    // --- Data Queries ---
    const { data: projectData, loading: projectLoading, refetch: refetchProject } = useQuery(GET_PROJECT, {
        variables: { id: projectId },
        skip: !projectId,
        pollInterval: 15000,
    });
    const project = projectData?.project;

    const { data: tasksData, loading: tasksLoading, refetch: refetchProjectTasks } = useQuery(GET_PROJECT_TASKS, {
        variables: { projectId, limit: 50 },
        skip: !projectId,
        pollInterval: 15000,
    });
    const tasks: Task[] = tasksData?.projectTasks?.tasks || [];

    const { data: divisionsData } = useQuery(GET_DIVISIONS);
    const divisions = divisionsData?.divisions || [];

    useEffect(() => {
        if (!project?.divisions) return;
        const load = async () => {
            const entries = await Promise.all(
                (project.divisions as number[]).map(async (kode: number) => {
                    const { data } = await client.query({ query: GET_COLLEAGUES_BY_DIVISI, variables: { divisiKode: kode } });
                    return [kode, data.colleaguesByDivisi as Colleague[]] as const;
                })
            );
            setDivisionMembers(Object.fromEntries(entries));
        };
        load();
    }, [project?.divisions, client]);

    const isProjectLeader = project?.leaders?.includes(me?.kodeku || '') || false;
    const isDivisionLeader = me?.pegawai?.statusLeader === 1;
    const canManage = isProjectLeader || (isDivisionLeader && project?.ownerDivisiKode === me?.pegawai?.divisi?.kode);

    const divisionName = (kode: number) => divisions.find((d: any) => d.kode === kode)?.nama || `Divisi ${kode}`;
    const nonJoinedDivisions = divisions.filter((d: any) => !project?.divisions?.includes(d.kode));
    const allMembers = useMemo(() => Object.values(divisionMembers).flat(), [divisionMembers]);

    // --- Mutations ---
    const [inviteDivision] = useMutation(INVITE_DIVISION);
    const [removeDivision] = useMutation(REMOVE_DIVISION);
    const [addProjectLeader] = useMutation(ADD_PROJECT_LEADER);
    const [removeProjectLeader] = useMutation(REMOVE_PROJECT_LEADER);
    const [createProjectTask, { loading: creatingTask }] = useMutation(CREATE_PROJECT_TASK);
    const [updateTaskMutation] = useMutation(UPDATE_TASK);
    const [deleteTaskMutation] = useMutation(DELETE_TASK);
    const [addCommentMutation] = useMutation(ADD_COMMENT);
    const [toggleReactionMutation] = useMutation(TOGGLE_REACTION);
    const [setMetaMutation] = useMutation(SET_META);
    const [deleteMetaMutation] = useMutation(DELETE_META);
    const [reorderMetaMutation] = useMutation(REORDER_META);
    const [reorderTasksMutation] = useMutation(REORDER_TASKS);
    const [advanceProjectStage, { loading: advancingStage }] = useMutation(ADVANCE_PROJECT_STAGE);
    const [reopenProjectMutation, { loading: reopeningProject }] = useMutation(REOPEN_PROJECT);

    // --- Handlers ---
    const handleDownloadReport = async () => {
        if (!projectId) return;
        setDownloadingReport(true);
        try {
            const res = await fetch(`/api/reports/project-summary?projectId=${projectId}`, {
                headers: {
                    Authorization: `Bearer ${sessionStorage.getItem('token') || ''}`,
                },
            });
            if (!res.ok) {
                const txt = await res.text();
                throw new Error(txt || 'Gagal mengunduh laporan');
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Laporan-Project-${project?.name || 'Report'}.pptx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            message.success('Laporan PPTX berhasil diunduh!');
        } catch (err: any) {
            message.error(err.message || 'Gagal mengunduh laporan PPTX');
        } finally {
            setDownloadingReport(false);
        }
    };

    const handleOpenTransitionModal = (stage: ProjectStage) => {
        setTargetStage(stage);
        setTransitionNote('');
        setForceTransition(false);
        setTransitionModalVisible(true);
    };

    const handleExecuteTransition = async () => {
        if (!projectId || !targetStage || !project) return;
        try {
            await advanceProjectStage({
                variables: {
                    projectId,
                    toStage: targetStage,
                    note: transitionNote || null,
                    expectedVersion: project.stageVersion,
                    force: forceTransition,
                },
                update(cache, { data }) {
                    if (data?.advanceProjectStage) {
                        cache.modify({
                            id: cache.identify({ __typename: 'Project', id: projectId }),
                            fields: {
                                stage() {
                                    return data.advanceProjectStage.stage;
                                },
                                stageVersion() {
                                    return data.advanceProjectStage.stageVersion;
                                },
                                stageHistory() {
                                    return data.advanceProjectStage.stageHistory;
                                },
                            },
                        });
                    }
                },
            });
            message.success(`Berhasil mengubah stage project ke ${STAGE_LABELS[targetStage]}`);
            setTransitionModalVisible(false);
            refetchProject();
        } catch (err: any) {
            message.error(err.message || 'Gagal mengubah stage project');
        }
    };

    const handleReopenProject = async () => {
        if (!projectId || !project) return;
        try {
            await reopenProjectMutation({
                variables: {
                    projectId,
                    expectedVersion: project.stageVersion,
                },
            });
            message.success('Project berhasil di-reopen ke IN_PROGRESS');
            refetchProject();
        } catch (err: any) {
            message.error(err.message || 'Gagal meng-reopen project');
        }
    };

    const handleInvite = () => {
        if (!inviteTarget || !projectId) return;
        inviteDivision({
            variables: { projectId, divisiKode: inviteTarget },
            optimisticResponse: { inviteDivisionToProject: true },
            update(cache) {
                const existing = cache.readQuery<{ project: any }>({ query: GET_PROJECT, variables: { id: projectId } });
                if (!existing) return;
                cache.writeQuery({
                    query: GET_PROJECT,
                    variables: { id: projectId },
                    data: { project: { ...existing.project, divisions: [...existing.project.divisions, inviteTarget] } },
                });
            },
        })
            .then(() => setInviteTarget(null))
            .catch((err) => message.error(err.message || 'Gagal mengundang divisi'));
    };

    const handleRemoveDivision = (divisiKode: number) => {
        if (!projectId) return;
        removeDivision({
            variables: { projectId, divisiKode },
            optimisticResponse: { removeDivisionFromProject: true },
            update(cache) {
                const existing = cache.readQuery<{ project: any }>({ query: GET_PROJECT, variables: { id: projectId } });
                if (!existing) return;
                cache.writeQuery({
                    query: GET_PROJECT,
                    variables: { id: projectId },
                    data: { project: { ...existing.project, divisions: existing.project.divisions.filter((d: number) => d !== divisiKode) } },
                });
            },
        }).catch((err) => message.error(err.message || 'Gagal mengeluarkan divisi'));
    };

    const handleAddLeader = (pegawaiKode: string) => {
        if (!projectId) return;
        addProjectLeader({
            variables: { projectId, pegawaiKode },
            optimisticResponse: { addProjectLeader: true },
            update(cache) {
                const existing = cache.readQuery<{ project: any }>({ query: GET_PROJECT, variables: { id: projectId } });
                if (!existing) return;
                cache.writeQuery({
                    query: GET_PROJECT,
                    variables: { id: projectId },
                    data: { project: { ...existing.project, leaders: [...existing.project.leaders, pegawaiKode] } },
                });
            },
        }).catch((err) => message.error(err.message || 'Gagal menambah project leader'));
    };

    const handleRemoveLeader = (pegawaiKode: string) => {
        if (!projectId) return;
        removeProjectLeader({
            variables: { projectId, pegawaiKode },
            optimisticResponse: { removeProjectLeader: true },
            update(cache) {
                const existing = cache.readQuery<{ project: any }>({ query: GET_PROJECT, variables: { id: projectId } });
                if (!existing) return;
                cache.writeQuery({
                    query: GET_PROJECT,
                    variables: { id: projectId },
                    data: { project: { ...existing.project, leaders: existing.project.leaders.filter((k: string) => k !== pegawaiKode) } },
                });
            },
        }).catch((err) => message.error(err.message || 'Gagal menghapus project leader'));
    };

    const handleCreateTask = async (values: { title: string; description?: string; targetUserKode?: string; startDate?: string; dueDate?: string; projectId?: string | null }) => {
        const targetProjId = values.projectId !== undefined ? values.projectId : projectId;
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
                                    return { ...existing, tasks: [{ __ref: cache.identify(data.createProjectTask) }, ...existing.tasks] };
                                },
                            },
                        });
                    },
                });
                setIsCreateTaskOpen(false);
            } catch (err: any) {
                message.error(err.message || 'Gagal membuat task');
            }
        }
    };

    const handleUpdate = (id: string, input: any) => {
        updateTaskMutation({
            variables: { id, input },
            optimisticResponse: { updateTask: { __typename: 'Task', id, ...input, updatedAt: new Date().toISOString() } },
        }).catch((err) => message.error(err.message || 'Gagal memperbarui task'));
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteTaskMutation({
                variables: { id },
                update(cache) {
                    cache.evict({ id: cache.identify({ __typename: 'Task', id }) });
                    cache.gc();
                },
            });
        } catch (err: any) {
            message.error(err.message || 'Gagal menghapus task');
        }
    };

    const handleAddComment = async (taskId: string, content: string, parentId: string | null, attachments: any[]) => {
        try {
            await addCommentMutation({ variables: { taskId, content, parentId, attachments } });
        } catch (err: any) {
            message.error(err.message || 'Gagal menambahkan komentar');
        }
    };

    const handleToggleReaction = (commentId: string, emoji: string) => {
        toggleReactionMutation({ variables: { commentId, emoji } }).catch((err) => message.error(err.message || 'Gagal memberi reaksi'));
    };

    const handleSetMeta = async (taskId: string, key: string, value: string | null, type: any) => {
        const { data } = await setMetaMutation({ variables: { taskId, key, value, type } });
        return data.setTaskMeta;
    };

    const handleDeleteMeta = async (id: string) => {
        await deleteMetaMutation({ variables: { id } });
    };

    const handleReorderMeta = (taskId: string, orderedIds: string[]) => {
        reorderMetaMutation({ variables: { taskId, orderedIds } }).catch((err) => message.error(err.message || 'Gagal mengubah urutan'));
    };

    const canManageTask = (task: any) => task.userKode === me?.kodeku || task.createdBy === me?.kodeku;

    const activeTasks = tasks.filter((t) => t.status !== 'COMPLETED');
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED');

    const handleTaskDragStart = (event: DragStartEvent) => {
        setDraggingTask(activeTasks.find((t) => t.id === event.active.id) || null);
    };

    const handleTaskDragEnd = (event: DragEndEvent) => {
        setDraggingTask(null);
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = activeTasks.findIndex((t) => t.id === active.id);
        const newIndex = activeTasks.findIndex((t) => t.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const orderedIds = arrayMove(activeTasks, oldIndex, newIndex).map((t) => t.id);
        reorderTasksMutation({ variables: { orderedIds } })
            .then(() => refetchProjectTasks())
            .catch((err) => message.error(err.message || 'Gagal mengubah urutan task'));
    };

    const handleBack = useCallback(() => navigate('/projects'), [navigate]);
    const headerExtra = useMemo(() => (
        <div className="flex items-center gap-2">
            <Button
                icon={<DownloadOutlined />}
                loading={downloadingReport}
                onClick={handleDownloadReport}
            >
                Laporan PPTX
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateTaskOpen(true)}>
                Buat Task
            </Button>
        </div>
    ), [downloadingReport, projectId]);

    useTeamHeader({ title: project?.name || 'Project', onBack: handleBack, headerExtra: project ? headerExtra : undefined });

    if (projectLoading || !project) {
        return <div className="flex justify-center py-20"><Spin size="large" /></div>;
    }

    const currentStage: ProjectStage = project.stage || 'PLANNING';
    const isPrimaryStage = PRIMARY_STAGES.includes(currentStage);
    const stepCurrentIndex = PRIMARY_STAGES.indexOf(currentStage);

    return (
        <div className="flex flex-col gap-6">
            {/* --- Top Info Bar & Stage Controls --- */}
            <div className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-xl p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Title level={4} className="!mb-0 !text-slate-900 dark:!text-slate-100">{project.name}</Title>
                            <Tag color={STAGE_COLORS[currentStage]}>{STAGE_LABELS[currentStage]}</Tag>
                            <Badge count={`v${project.stageVersion}`} style={{ backgroundColor: '#64748B' }} />
                        </div>
                        {project.description && (
                            <Paragraph className="!mb-0 !text-slate-500 dark:!text-slate-400 text-sm">{project.description}</Paragraph>
                        )}
                    </div>

                    {/* Action buttons for stage */}
                    {isProjectLeader && (
                        <div className="flex flex-wrap items-center gap-2">
                            {currentStage === 'PLANNING' && (
                                <>
                                    <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleOpenTransitionModal('IN_PROGRESS')}>
                                        Mulai In Progress
                                    </Button>
                                    <Button onClick={() => handleOpenTransitionModal('ON_HOLD')}>On Hold</Button>
                                    <Button danger onClick={() => handleOpenTransitionModal('REJECTED')}>Tolak</Button>
                                    <Button danger type="dashed" onClick={() => handleOpenTransitionModal('CANCELLED')}>Batalkan</Button>
                                </>
                            )}
                            {currentStage === 'IN_PROGRESS' && (
                                <>
                                    <Button type="primary" icon={<ClockCircleOutlined />} onClick={() => handleOpenTransitionModal('REVIEW')}>
                                        Ajukan Review
                                    </Button>
                                    <Button onClick={() => handleOpenTransitionModal('ON_HOLD')}>On Hold</Button>
                                    <Button danger onClick={() => handleOpenTransitionModal('REJECTED')}>Tolak</Button>
                                    <Button danger type="dashed" onClick={() => handleOpenTransitionModal('CANCELLED')}>Batalkan</Button>
                                </>
                            )}
                            {currentStage === 'REVIEW' && (
                                <>
                                    <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => handleOpenTransitionModal('DONE')}>
                                        Selesaikan (Done)
                                    </Button>
                                    <Button danger onClick={() => handleOpenTransitionModal('REJECTED')}>Minta Perbaikan</Button>
                                    <Button onClick={() => handleOpenTransitionModal('IN_PROGRESS')}>Kembali ke In Progress</Button>
                                </>
                            )}
                            {currentStage === 'REJECTED' && (
                                <>
                                    <Button type="primary" icon={<RedoOutlined />} onClick={() => handleOpenTransitionModal('IN_PROGRESS')}>
                                        Revisi & Kerjakan Kembali
                                    </Button>
                                    <Button onClick={() => handleOpenTransitionModal('PLANNING')}>Kembali ke Planning</Button>
                                </>
                            )}
                            {currentStage === 'ON_HOLD' && (
                                <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleOpenTransitionModal('IN_PROGRESS')}>
                                    Lanjutkan Project
                                </Button>
                            )}
                            {(currentStage === 'DONE' || currentStage === 'CANCELLED') && (
                                <Button type="primary" icon={<RedoOutlined />} loading={reopeningProject} onClick={handleReopenProject}>
                                    Re-open Project
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* --- Project Stage Steps --- */}
                {isPrimaryStage ? (
                    <Steps
                        current={stepCurrentIndex}
                        items={[
                            { title: 'Planning', description: 'Perencanaan & Alokasi Task' },
                            { title: 'In Progress', description: 'Eksekusi & Pengerjaan' },
                            { title: 'Review', description: 'Peninjauan Hasil' },
                            { title: 'Done', description: 'Selesai & Dideploy' },
                        ]}
                    />
                ) : (
                    <Alert
                        type={currentStage === 'REJECTED' ? 'error' : currentStage === 'CANCELLED' ? 'warning' : 'info'}
                        showIcon
                        icon={currentStage === 'REJECTED' ? <CloseCircleOutlined /> : currentStage === 'CANCELLED' ? <ExclamationCircleOutlined /> : <PauseCircleOutlined />}
                        message={`Status Saat Ini: ${STAGE_LABELS[currentStage]}`}
                        description={
                            currentStage === 'REJECTED'
                                ? 'Project memerlukan penyesuaian atau revisi sebelum dapat dilanjutkan.'
                                : currentStage === 'CANCELLED'
                                ? 'Project telah dibatalkan.'
                                : 'Project sedang ditahan sementara.'
                        }
                    />
                )}
            </div>

            {/* --- Division Progress Bars --- */}
            {project.divisionProgress && project.divisionProgress.length > 0 && (
                <div className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-xl p-5 shadow-sm">
                    <Title level={5} className="!mb-4 !text-slate-800 dark:!text-slate-200">Progress per Divisi</Title>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {project.divisionProgress.map((dp: any) => (
                            <div key={dp.divisiKode} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                <div className="flex justify-between items-center mb-1">
                                    <Text className="font-semibold text-slate-700 dark:text-slate-200">{divisionName(dp.divisiKode)}</Text>
                                    <Text className="text-xs text-slate-500">{dp.completedTasks} / {dp.totalTasks} Selesai</Text>
                                </div>
                                <Progress percent={Math.round(dp.percentDone)} status={dp.percentDone === 100 ? 'success' : 'active'} />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- Division & Leader Management --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-xl p-4">
                    <Title level={5} className="!mb-3 !text-slate-800 dark:!text-slate-200">Divisi Tergabung</Title>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {project.divisions.map((kode: number) => (
                            <Tag
                                key={kode}
                                closable={canManage && kode !== project.ownerDivisiKode}
                                onClose={(e) => { e.preventDefault(); handleRemoveDivision(kode); }}
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
                            const member = allMembers.find((m) => m.kodeku === kode);
                            return (
                                <Tag
                                    key={kode}
                                    icon={<CrownFilled />}
                                    color="gold"
                                    closable={isProjectLeader && project.leaders.length > 1}
                                    onClose={(e) => { e.preventDefault(); handleRemoveLeader(kode); }}
                                >
                                    {member?.nama || kode}
                                </Tag>
                            );
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
            </div>

            {/* --- Stage History Timeline --- */}
            {project.stageHistory && project.stageHistory.length > 0 && (
                <Collapse
                    className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-xl"
                    items={[
                        {
                            key: 'history',
                            label: <span className="font-medium text-slate-700 dark:text-slate-200">Riwayat Perubahan Stage ({project.stageHistory.length})</span>,
                            children: (
                                <Timeline
                                    className="mt-2"
                                    items={project.stageHistory.map((sh: any) => ({
                                        children: (
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <Tag color={STAGE_COLORS[sh.fromStage as ProjectStage]}>{STAGE_LABELS[sh.fromStage as ProjectStage] || sh.fromStage}</Tag>
                                                    <span>→</span>
                                                    <Tag color={STAGE_COLORS[sh.toStage as ProjectStage]}>{STAGE_LABELS[sh.toStage as ProjectStage] || sh.toStage}</Tag>
                                                    <Text className="text-xs text-slate-400">{sh.changedAt}</Text>
                                                </div>
                                                <Text className="text-xs text-slate-500 block mt-1">
                                                    Oleh: <span className="font-medium text-slate-700 dark:text-slate-300">{sh.changedBy}</span>
                                                    {sh.note && ` — Note: "${sh.note}"`}
                                                </Text>
                                            </div>
                                        ),
                                    }))}
                                />
                            ),
                        },
                    ]}
                />
            )}

            {/* --- Task Section --- */}
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
                                className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-xl mt-4"
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

            {/* --- Create Task Modal --- */}
            <CreateTaskModal
                open={isCreateTaskOpen}
                onCancel={() => setIsCreateTaskOpen(false)}
                onCreate={handleCreateTask}
                loading={creatingTask}
                initialProjectId={projectId}
            />

            {/* --- Stage Transition Modal --- */}
            <Modal
                title={`Ubah Stage Project ke ${targetStage ? STAGE_LABELS[targetStage] : ''}`}
                open={transitionModalVisible}
                onCancel={() => setTransitionModalVisible(false)}
                onOk={handleExecuteTransition}
                confirmLoading={advancingStage}
                okText="Konfirmasi"
                cancelText="Batal"
            >
                <div className="py-2 flex flex-col gap-4">
                    {targetStage === 'DONE' && activeTasks.length > 0 && (
                        <Alert
                            type="warning"
                            showIcon
                            message={`Perhatian: Masih ada ${activeTasks.length} task belum selesai.`}
                            description={
                                <div>
                                    <p className="mb-2">Menyelesaikan project saat masih ada task aktif membutuhkan konfirmasi eksplisit.</p>
                                    <label className="flex items-center gap-2 cursor-pointer font-medium text-amber-900">
                                        <input
                                            type="checkbox"
                                            checked={forceTransition}
                                            onChange={(e) => setForceTransition(e.target.checked)}
                                        />
                                        Saya paham dan tetap ingin menyelesaikan project ini.
                                    </label>
                                </div>
                            }
                        />
                    )}
                    <div>
                        <Text className="block font-medium mb-1">Catatan Perubahan Stage (Opsional):</Text>
                        <Input.TextArea
                            rows={3}
                            placeholder="Tuliskan catatan singkat atau pertimbangan perubahan stage..."
                            value={transitionNote}
                            onChange={(e) => setTransitionNote(e.target.value)}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}
