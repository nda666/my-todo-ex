import React, { useCallback, useMemo, useState } from 'react';

import {
    Alert,
    Avatar,
    Button,
    Card,
    Empty,
    Input,
    Modal,
    Progress,
    Radio,
    Select,
    Spin,
    Tag,
    Tooltip,
    Typography,
    message,
} from 'antd';
import {
    useNavigate,
    useParams,
} from 'react-router-dom';

import {
    AlertOutlined,
    CheckCircleOutlined,
    CrownFilled,
    DashboardOutlined,
    PlusOutlined,
    RedoOutlined,
    SearchOutlined,
    SwapOutlined,
    UserOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery } from '@apollo/client';

import CreateTaskModal from '../components/CreateTaskModal';
import TeamBoardColumn from '../components/TeamBoardColumn';
import { CAPACITY_LIMIT_PER_MEMBER, getWorkloadInfo, MemberWorkloadInfo } from '../components/WorkloadCapacityWidget';
import { useAuth } from '../contexts/AuthContext';
import { useTeamHeader } from '../layouts/TeamLayout';
import { CREATE_TASK, GET_COLLEAGUES_BY_DIVISI, GET_TASKS, UPDATE_TASK } from '../lib/queries';
import { Colleague, Task } from '../types/task';

const { Title, Text, Paragraph } = Typography;

export default function TeamBoard() {
    const { me } = useAuth();
    const navigate = useNavigate();
    const { divisiId } = useParams<{ divisiId: string }>();
    const divisiKode = Number(divisiId);

    const [quickAssignUserKode, setQuickAssignUserKode] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('ALL');
    const [rebalanceMember, setRebalanceMember] = useState<MemberWorkloadInfo | null>(null);
    const [selectedTaskToReassign, setSelectedTaskToReassign] = useState<Task | null>(null);
    const [targetUserKode, setTargetUserKode] = useState<string | null>(null);
    const [reassigning, setReassigning] = useState(false);

    const isLeader = me?.pegawai?.statusLeader === 1;

    const handleBack = useCallback(
        () => navigate(`/teams/${divisiKode}`, { preventScrollReset: true }),
        [navigate, divisiKode]
    );
    useTeamHeader({ title: 'Board & Kapasitas Tim', onBack: handleBack });

    const { data, loading: loadingMembers, refetch: refetchMembers } = useQuery(GET_COLLEAGUES_BY_DIVISI, {
        variables: { divisiKode },
        skip: !divisiKode,
    });
    const members: Colleague[] = data?.colleaguesByDivisi || [];

    const { data: tasksData, refetch: refetchTasks, loading: loadingTasks } = useQuery(GET_TASKS, {
        variables: { limit: 200 },
        fetchPolicy: 'cache-and-network',
    });
    const teamTasks: Task[] = useMemo(() => tasksData?.tasks?.tasks || [], [tasksData]);

    const [createTaskMutation, { loading: creatingTask }] = useMutation(CREATE_TASK);
    const [updateTaskMutation] = useMutation(UPDATE_TASK);

    // Compute workload per member
    const workloadList: MemberWorkloadInfo[] = useMemo(() => {
        if (!members || members.length === 0) return [];

        const taskMap = new Map<string, Task[]>();
        teamTasks.forEach((t) => {
            const k = t.userKode || 'UNASSIGNED';
            if (!taskMap.has(k)) taskMap.set(k, []);
            taskMap.get(k)!.push(t);
        });

        return members.map((m) => {
            const userTasks = taskMap.get(m.kodeku) || [];
            const pendingTasks = userTasks.filter((t) => t.status === 'PENDING').length;
            const inProgressTasks = userTasks.filter((t) => t.status === 'IN_PROGRESS').length;
            const completedTasks = userTasks.filter((t) => t.status === 'COMPLETED').length;
            const activeTasks = pendingTasks + inProgressTasks;
            const totalTasks = userTasks.length;

            const info = getWorkloadInfo(activeTasks);
            const capacityPercentage = Math.min(Math.round((activeTasks / CAPACITY_LIMIT_PER_MEMBER) * 100), 100);

            return {
                member: m,
                totalTasks,
                pendingTasks,
                inProgressTasks,
                completedTasks,
                activeTasks,
                capacityPercentage,
                level: info.level,
                levelLabel: info.label,
                levelColor: info.color,
                levelBg: `${info.color}15`,
                userTasks,
            };
        });
    }, [members, teamTasks]);

    // Summary Analytics
    const summary = useMemo(() => {
        const totalMembers = workloadList.length;
        const totalActiveTasks = workloadList.reduce((acc, curr) => acc + curr.activeTasks, 0);
        const avgActiveTasks = totalMembers > 0 ? (totalActiveTasks / totalMembers).toFixed(1) : '0';

        const overloaded = workloadList.filter((w) => w.level === 'OVERLOADED');
        const heavy = workloadList.filter((w) => w.level === 'HEAVY');
        const optimal = workloadList.filter((w) => w.level === 'OPTIMAL');
        const light = workloadList.filter((w) => w.level === 'LIGHT');

        const maxTeamCapacity = totalMembers * CAPACITY_LIMIT_PER_MEMBER;
        const overallTeamUtilization =
            maxTeamCapacity > 0 ? Math.min(Math.round((totalActiveTasks / maxTeamCapacity) * 100), 100) : 0;

        return {
            totalMembers,
            totalActiveTasks,
            avgActiveTasks,
            overloadedCount: overloaded.length,
            heavyCount: heavy.length,
            optimalCount: optimal.length,
            lightCount: light.length,
            overallTeamUtilization,
        };
    }, [workloadList]);

    // Filter members based on capacity filter and search query
    const filteredMembers = useMemo(() => {
        return members.filter((m) => {
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchName = m.nama?.toLowerCase().includes(query);
                const matchJob = m.jabatan?.nama?.toLowerCase().includes(query);
                if (!matchName && !matchJob) return false;
            }

            if (selectedLevelFilter !== 'ALL') {
                const wl = workloadList.find((w) => w.member.kodeku === m.kodeku);
                if (!wl || wl.level !== selectedLevelFilter) return false;
            }

            return true;
        });
    }, [members, searchQuery, selectedLevelFilter, workloadList]);

    const handleCreateTaskForMember = async (values: any) => {
        try {
            await createTaskMutation({
                variables: {
                    input: {
                        title: values.title,
                        description: values.description || null,
                        targetUserKode: values.targetUserKode || quickAssignUserKode,
                        startDate: values.startDate || null,
                        dueDate: values.dueDate || null,
                        projectId: values.projectId || null,
                        meta: values.meta || [],
                        subtasks: values.subtasks || [],
                    },
                },
            });
            message.success('Task berhasil dibuat dan ditugaskan');
            setQuickAssignUserKode(null);
            refetchTasks();
        } catch (err: any) {
            message.error(err.message || 'Gagal menugaskan task');
        }
    };

    const handleExecuteReassign = async () => {
        if (!selectedTaskToReassign || !targetUserKode) return;
        setReassigning(true);
        try {
            await updateTaskMutation({
                variables: {
                    id: selectedTaskToReassign.id,
                    input: { targetUserKode },
                },
            });
            message.success('Beban kerja task berhasil dipindahkan!');
            setSelectedTaskToReassign(null);
            setTargetUserKode(null);
            setRebalanceMember(null);
            refetchTasks();
        } catch (err: any) {
            message.error(err.message || 'Gagal memindahkan task');
        } finally {
            setReassigning(false);
        }
    };

    const handleRefresh = () => {
        refetchMembers();
        refetchTasks();
    };

    return (
        <div className="space-y-4">
            {/* Top Corporate Summary Analytics Card (Option A + B Hybrid) */}
            <Card className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <Title level={5} className="!mb-1 !text-slate-800 dark:!text-slate-100 flex items-center gap-2">
                            <DashboardOutlined className="text-blue-500" /> Executive Workload & Team Capacity Board
                        </Title>
                        <Text className="text-xs !text-slate-500 dark:!text-slate-400">
                            Papan kolaborasi tugas tim divisi & pemantauan kapasitas kerja pegawai secara real-time.
                        </Text>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            size="small"
                            icon={<RedoOutlined />}
                            onClick={handleRefresh}
                            className="text-xs text-slate-600 dark:text-slate-300 rounded-lg"
                        >
                            Refresh
                        </Button>
                        <Tag color="blue" className="text-xs font-semibold px-3 py-1 rounded-full m-0">
                            Total Aktif: {summary.totalActiveTasks} Task
                        </Tag>
                    </div>
                </div>

                {/* KPI Metrics Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
                    <div className="p-3 bg-slate-100/70 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                        <Text className="text-[11px] text-slate-500 dark:text-slate-400 block">Utilisasi Tim Divisi</Text>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                {summary.overallTeamUtilization}%
                            </span>
                            <Progress
                                percent={summary.overallTeamUtilization}
                                showInfo={false}
                                size="small"
                                strokeColor={
                                    summary.overallTeamUtilization > 85
                                        ? '#ef4444'
                                        : summary.overallTeamUtilization > 65
                                        ? '#f59e0b'
                                        : '#3b82f6'
                                }
                                className="w-16 m-0"
                            />
                        </div>
                    </div>

                    <div className="p-3 bg-slate-100/70 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                        <Text className="text-[11px] text-slate-500 dark:text-slate-400 block">Rata-rata Task / Anggota</Text>
                        <span className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1 block">
                            {summary.avgActiveTasks} task
                        </span>
                    </div>

                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/60 dark:border-emerald-800/50">
                        <Text className="text-[11px] text-emerald-700 dark:text-emerald-400 block">
                            Tersedia (Available)
                        </Text>
                        <span className="text-xl font-bold text-emerald-600 dark:text-emerald-300 mt-1 block">
                            {summary.lightCount + summary.optimalCount} Anggota
                        </span>
                    </div>

                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200/60 dark:border-amber-800/50">
                        <Text className="text-[11px] text-amber-700 dark:text-amber-400 block flex items-center gap-1">
                            Overloaded / High Load {summary.overloadedCount > 0 && <AlertOutlined className="text-red-500" />}
                        </Text>
                        <span className="text-xl font-bold text-amber-600 dark:text-amber-300 mt-1 block">
                            {summary.heavyCount + summary.overloadedCount} Anggota
                        </span>
                    </div>
                </div>
            </Card>

            {/* Controls Bar: Filters, Search, Rebalance Quick Trigger */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                {/* Level Filter Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    {[
                        { key: 'ALL', label: `Semua (${members.length})` },
                        { key: 'LIGHT', label: `Light (${summary.lightCount})` },
                        { key: 'OPTIMAL', label: `Optimal (${summary.optimalCount})` },
                        { key: 'HEAVY', label: `High Load (${summary.heavyCount})` },
                        { key: 'OVERLOADED', label: `Overloaded (${summary.overloadedCount})` },
                    ].map((f) => (
                        <Button
                            key={f.key}
                            size="small"
                            type={selectedLevelFilter === f.key ? 'primary' : 'text'}
                            onClick={() => setSelectedLevelFilter(f.key)}
                            className={`rounded-lg text-xs font-medium ${
                                selectedLevelFilter === f.key
                                    ? ''
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            {f.label}
                        </Button>
                    ))}
                </div>

                {/* Right Controls: Search */}
                <div className="flex items-center gap-2">
                    <Input
                        placeholder="Cari anggota atau jabatan..."
                        prefix={<SearchOutlined className="text-slate-400" />}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        size="small"
                        allowClear
                        className="w-full sm:w-56 rounded-lg text-xs"
                    />
                </div>
            </div>

            {/* Main Board Columns */}
            {loadingMembers ? (
                <div className="flex justify-center py-20">
                    <Spin size="large" />
                </div>
            ) : filteredMembers.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-12 text-center">
                    <Empty
                        description={<span className="text-slate-400 text-xs">Tidak ada anggota tim yang sesuai dengan filter.</span>}
                    />
                </div>
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-6" style={{ scrollSnapType: 'x proximity' }}>
                    {filteredMembers.map((m: Colleague) => {
                        const wl = workloadList.find((w) => w.member.kodeku === m.kodeku);
                        const activeCount = wl ? wl.activeTasks : 0;
                        const levelLabel = wl ? wl.levelLabel : 'Light Capacity';
                        const tagColor = wl ? (wl.level === 'LIGHT' ? 'green' : wl.level === 'OPTIMAL' ? 'blue' : wl.level === 'HEAVY' ? 'orange' : 'red') : 'green';
                        const capacityPct = wl ? wl.capacityPercentage : 0;
                        const levelColor = wl ? wl.levelColor : '#10b981';

                        return (
                            <div
                                key={m.kodeku}
                                style={{ scrollSnapAlign: 'start' }}
                                className="shrink-0 w-[88vw] max-w-[340px] flex flex-col bg-slate-100/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3 shadow-xs"
                            >
                                {/* Column Header - Member Info & Capacity Bar */}
                                <div className="bg-white dark:bg-slate-800/90 rounded-xl p-3 border border-slate-200/80 dark:border-slate-700/80 mb-3 shadow-2xs">
                                    <div
                                        onClick={() => navigate(`/teams/${divisiKode}/${m.kodeku}`)}
                                        className="flex items-center justify-between gap-2 cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <Avatar
                                                size={34}
                                                src={m.avatarUrl || undefined}
                                                icon={!m.avatarUrl && <UserOutlined />}
                                                className="!bg-blue-500 text-white flex-shrink-0"
                                            />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1 font-semibold text-sm text-slate-800 dark:text-slate-100 group-hover:text-blue-600 truncate">
                                                    <span className="truncate">{m.nama}</span>
                                                    {m.statusLeader === 1 && (
                                                        <CrownFilled className="!text-amber-500 text-xs flex-shrink-0" />
                                                    )}
                                                </div>
                                                <span className="text-[11px] text-slate-400 block truncate">
                                                    {m.jabatan?.nama || 'Pegawai'}
                                                </span>
                                            </div>
                                        </div>

                                        <Tag color={tagColor} className="m-0 text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
                                            {levelLabel}
                                        </Tag>
                                    </div>

                                    {/* Capacity Progress Bar */}
                                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                                        <span>Beban Task: <b className="text-slate-700 dark:text-slate-300">{activeCount} / {CAPACITY_LIMIT_PER_MEMBER}</b></span>
                                        <div className="w-24">
                                            <Progress percent={capacityPct} showInfo={false} size="small" strokeColor={levelColor} className="m-0" />
                                        </div>

                                        {isLeader && wl && wl.activeTasks > 0 && (
                                            <Tooltip title="Rebalance task anggota ini">
                                                <Button
                                                    size="small"
                                                    type="text"
                                                    icon={<SwapOutlined />}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setRebalanceMember(wl);
                                                    }}
                                                    className="p-0 h-auto text-xs text-blue-500 hover:text-blue-600"
                                                />
                                            </Tooltip>
                                        )}
                                    </div>
                                </div>

                                {/* Column Task List Container */}
                                <TeamBoardColumn
                                    userKode={m.kodeku}
                                    editable={isLeader || m.kodeku === me?.kodeku}
                                    members={members}
                                    onQuickAssign={isLeader ? (uKode) => setQuickAssignUserKode(uKode) : undefined}
                                />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Quick Assign Modal */}
            <CreateTaskModal
                open={!!quickAssignUserKode}
                onCancel={() => setQuickAssignUserKode(null)}
                onCreate={handleCreateTaskForMember}
                loading={creatingTask}
                assignees={members}
            />

            {/* Rebalance Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <SwapOutlined className="text-blue-500" />
                        <span>Rebalance Task - {rebalanceMember?.member.nama}</span>
                    </div>
                }
                open={!!rebalanceMember}
                onCancel={() => {
                    setRebalanceMember(null);
                    setSelectedTaskToReassign(null);
                    setTargetUserKode(null);
                }}
                footer={null}
                width={540}
            >
                {rebalanceMember && (
                    <div className="py-2">
                        <Paragraph className="text-xs text-slate-500 mb-4">
                            Pindahkan task aktif dari <b>{rebalanceMember.member.nama}</b> ke anggota divisi lain yang masih berkapasitas optimal.
                        </Paragraph>

                        <div className="space-y-3 mb-4">
                            <Text className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                                1. Pilih Task untuk Dipindahkan:
                            </Text>
                            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                                {rebalanceMember.userTasks.filter((t) => t.status !== 'COMPLETED').length === 0 ? (
                                    <Empty description="Tidak ada task aktif untuk dipindahkan." image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                ) : (
                                    rebalanceMember.userTasks
                                        .filter((t) => t.status !== 'COMPLETED')
                                        .map((task) => (
                                            <div
                                                key={task.id}
                                                onClick={() => setSelectedTaskToReassign(task)}
                                                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                                                    selectedTaskToReassign?.id === task.id
                                                        ? 'bg-blue-50 border-blue-400 dark:bg-blue-950/40 dark:border-blue-600'
                                                        : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 hover:border-slate-300'
                                                }`}
                                            >
                                                <div>
                                                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                                                        {task.title}
                                                    </div>
                                                    <Tag color={task.status === 'IN_PROGRESS' ? 'blue' : 'amber'} className="text-[10px] m-0 mt-1">
                                                        {task.status}
                                                    </Tag>
                                                </div>
                                                {selectedTaskToReassign?.id === task.id && (
                                                    <CheckCircleOutlined className="text-blue-600 text-base" />
                                                )}
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>

                        {selectedTaskToReassign && (
                            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                                <Text className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                                    2. Pilih Assignee Baru:
                                </Text>
                                <Select
                                    placeholder="Pilih anggota divisi penerima task..."
                                    className="w-full"
                                    size="large"
                                    value={targetUserKode}
                                    onChange={setTargetUserKode}
                                    options={workloadList
                                        .filter((w) => w.member.kodeku !== rebalanceMember.member.kodeku)
                                        .map((w) => ({
                                            label: `${w.member.nama} (${w.levelLabel} - ${w.activeTasks} task)`,
                                            value: w.member.kodeku,
                                        }))}
                                />

                                <div className="flex justify-end gap-2 pt-4">
                                    <Button
                                        onClick={() => {
                                            setRebalanceMember(null);
                                            setSelectedTaskToReassign(null);
                                            setTargetUserKode(null);
                                        }}
                                    >
                                        Batal
                                    </Button>
                                    <Button
                                        type="primary"
                                        loading={reassigning}
                                        disabled={!targetUserKode}
                                        onClick={handleExecuteReassign}
                                    >
                                        Pindahkan Task
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}
