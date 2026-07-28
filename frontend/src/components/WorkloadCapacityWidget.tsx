import React, { useMemo, useState } from 'react';
import { useMutation } from '@apollo/client';

import {
    Avatar,
    Badge,
    Button,
    Card,
    Drawer,
    Empty,
    Modal,
    Progress,
    Select,
    Spin,
    Tag,
    Tooltip,
    Typography,
    message,
} from 'antd';

import {
    AlertOutlined,
    CheckCircleOutlined,
    DashboardOutlined,
    InfoCircleOutlined,
    RedoOutlined,
    RobotOutlined,
    RocketOutlined,
    SwapOutlined,
    ThunderboltOutlined,
    UserOutlined,
} from '@ant-design/icons';

import { Colleague, Task } from '../types/task';
import { ASK_DORA } from '../graphql/dora';

const { Title, Text, Paragraph } = Typography;

export type WorkloadLevel = 'LIGHT' | 'OPTIMAL' | 'HEAVY' | 'OVERLOADED';

export interface MemberWorkloadInfo {
    member: Colleague;
    totalTasks: number;
    pendingTasks: number;
    inProgressTasks: number;
    completedTasks: number;
    activeTasks: number;
    capacityPercentage: number;
    level: WorkloadLevel;
    levelLabel: string;
    levelColor: string;
    levelBg: string;
    userTasks: Task[];
}

interface WorkloadCapacityWidgetProps {
    members: Colleague[];
    tasks: Task[];
    isLeader?: boolean;
    onReassignTask?: (taskId: string, targetUserKode: string) => Promise<void>;
    onRefreshTasks?: () => void;
}

export const CAPACITY_LIMIT_PER_MEMBER = 6;

export function getWorkloadInfo(activeTasks: number): {
    level: WorkloadLevel;
    label: string;
    color: string;
    badgeStatus: 'success' | 'processing' | 'warning' | 'error';
    tagColor: string;
} {
    if (activeTasks <= 2) {
        return {
            level: 'LIGHT',
            label: 'Light Capacity',
            color: '#10b981',
            badgeStatus: 'success',
            tagColor: 'green',
        };
    } else if (activeTasks <= 4) {
        return {
            level: 'OPTIMAL',
            label: 'Optimal',
            color: '#3b82f6',
            badgeStatus: 'processing',
            tagColor: 'blue',
        };
    } else if (activeTasks <= 6) {
        return {
            level: 'HEAVY',
            label: 'High Capacity',
            color: '#f59e0b',
            badgeStatus: 'warning',
            tagColor: 'orange',
        };
    } else {
        return {
            level: 'OVERLOADED',
            label: 'Overloaded',
            color: '#ef4444',
            badgeStatus: 'error',
            tagColor: 'red',
        };
    }
}

export default function WorkloadCapacityWidget({
    members,
    tasks,
    isLeader = false,
    onReassignTask,
    onRefreshTasks,
}: WorkloadCapacityWidgetProps) {
    const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('ALL');
    const [rebalanceMember, setRebalanceMember] = useState<MemberWorkloadInfo | null>(null);
    const [selectedTaskToReassign, setSelectedTaskToReassign] = useState<Task | null>(null);
    const [targetUserKode, setTargetUserKode] = useState<string | null>(null);
    const [reassigning, setReassigning] = useState(false);

    // AI Workload Advisor State
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);
    const [executingAiTaskId, setExecutingAiTaskId] = useState<string | null>(null);
    const [askDoraMutation, { loading: isAiAnalyzing }] = useMutation(ASK_DORA);

    // Calculate workload stats per member
    const workloadList: MemberWorkloadInfo[] = useMemo(() => {
        if (!members || members.length === 0) return [];

        const taskMap = new Map<string, Task[]>();
        tasks.forEach((t) => {
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
    }, [members, tasks]);

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
        const overallTeamUtilization = maxTeamCapacity > 0 ? Math.min(Math.round((totalActiveTasks / maxTeamCapacity) * 100), 100) : 0;

        return {
            totalMembers,
            totalActiveTasks,
            avgActiveTasks,
            overloadedCount: overloaded.length,
            heavyCount: heavy.length,
            optimalCount: optimal.length,
            lightCount: light.length,
            overallTeamUtilization,
            availableMembers: [...light, ...optimal],
        };
    }, [workloadList]);

    // Compute AI Smart Reassignment Proposals algorithmically
    const aiReassignmentProposals = useMemo(() => {
        const proposals: Array<{
            taskId: string;
            taskTitle: string;
            fromMember: Colleague;
            toMember: Colleague;
            reason: string;
        }> = [];

        const overloadedMembers = workloadList.filter((w) => w.level === 'OVERLOADED' || w.level === 'HEAVY');
        const availableMembers = workloadList.filter((w) => w.level === 'LIGHT' || w.level === 'OPTIMAL');

        if (overloadedMembers.length === 0 || availableMembers.length === 0) return proposals;

        // Sort available members by fewest active tasks ascending
        const sortedAvailable = [...availableMembers].sort((a, b) => a.activeTasks - b.activeTasks);

        let targetIdx = 0;
        for (const overloaded of overloadedMembers) {
            const activeTasksToConsider = overloaded.userTasks.filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
            if (activeTasksToConsider.length > 0) {
                const taskToMove = activeTasksToConsider[0];
                const recipient = sortedAvailable[targetIdx % sortedAvailable.length];

                proposals.push({
                    taskId: taskToMove.id,
                    taskTitle: taskToMove.title,
                    fromMember: overloaded.member,
                    toMember: recipient.member,
                    reason: `${overloaded.member.nama} (${overloaded.activeTasks} task aktif) dialihkan ke ${recipient.member.nama} (${recipient.activeTasks} task) untuk mencegah kelesuan & burnout.`,
                });

                targetIdx++;
            }
        }

        return proposals;
    }, [workloadList]);

    const handleRunAiAnalysis = async () => {
        setIsAiModalOpen(true);
        if (aiAnalysisResult) return;

        try {
            const payloadSummary = workloadList.map((w) => ({
                nama: w.member.nama,
                statusKapasitas: w.levelLabel,
                activeTasksCount: w.activeTasks,
                completedTasksCount: w.completedTasks,
            }));

            const promptMessage = `Berikan analisis beban kerja tim singkat & strategi penyeimbangan tugas (maksimal 2 paragraf padat + 3 poin saran tindakan):
- Anggota Tim: ${JSON.stringify(payloadSummary)}
- Utilisasi Tim Divisi: ${summary.overallTeamUtilization}%
- Anggota Overloaded: ${summary.overloadedCount} orang`;

            const res = await askDoraMutation({
                variables: {
                    message: promptMessage,
                    sessionId: `workload_advisor_${Date.now()}`,
                },
            });

            if (res.data?.askDora?.reply) {
                setAiAnalysisResult(res.data.askDora.reply);
            }
        } catch (err) {
            setAiAnalysisResult('Gagal menghubungi AI Assistant. Anda tetap dapat menggunakan rekomendasi redistribusi tugas berbasis AI di bawah.');
        }
    };

    const handleApplyAiReassign = async (taskId: string, targetKode: string) => {
        if (!onReassignTask) return;
        setExecutingAiTaskId(taskId);
        try {
            await onReassignTask(taskId, targetKode);
            message.success('Rekomendasi AI berhasil diterapkan!');
            if (onRefreshTasks) onRefreshTasks();
        } catch (err: any) {
            message.error(err.message || 'Gagal memindahkan task');
        } finally {
            setExecutingAiTaskId(null);
        }
    };

    const filteredList = useMemo(() => {
        if (selectedLevelFilter === 'ALL') return workloadList;
        return workloadList.filter((w) => w.level === selectedLevelFilter);
    }, [workloadList, selectedLevelFilter]);

    const handleExecuteReassign = async () => {
        if (!selectedTaskToReassign || !targetUserKode || !onReassignTask) return;
        setReassigning(true);
        try {
            await onReassignTask(selectedTaskToReassign.id, targetUserKode);
            message.success('Beban kerja berhasil dipindahkan!');
            setSelectedTaskToReassign(null);
            setTargetUserKode(null);
            if (onRefreshTasks) onRefreshTasks();
        } catch (err: any) {
            message.error(err.message || 'Gagal memindahkan task');
        } finally {
            setReassigning(false);
        }
    };

    return (
        <Card className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-2xl shadow-sm mb-6 overflow-hidden">
            {/* Widget Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                    <Title level={5} className="!mb-1 !text-slate-800 dark:!text-slate-100 flex items-center gap-2">
                        <DashboardOutlined className="text-blue-500" /> Manajemen Beban Kerja & Kapasitas Tim
                    </Title>
                    <Text className="text-xs !text-slate-500 dark:!text-slate-400">
                        Pantau kapasitas anggota divisi dan seimbangkan penugasan task untuk mencegah burnout.
                    </Text>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        type="primary"
                        icon={<RobotOutlined />}
                        onClick={handleRunAiAnalysis}
                        className="!bg-gradient-to-r !from-indigo-600 !to-blue-600 hover:!from-indigo-500 hover:!to-blue-500 !border-0 text-xs font-semibold rounded-xl shadow-xs"
                    >
                        AI Workload Advisor
                    </Button>
                    {onRefreshTasks && (
                        <Button
                            size="small"
                            icon={<RedoOutlined />}
                            onClick={onRefreshTasks}
                            className="text-xs text-slate-500 dark:text-slate-400 rounded-xl"
                        >
                            Refresh
                        </Button>
                    )}
                    <Tag color="blue" className="text-xs font-semibold px-2.5 py-1 rounded-full m-0">
                        Total Aktif: {summary.totalActiveTasks} Task
                    </Tag>
                </div>
            </div>

            {/* Quick KPI Overview Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 border-b border-slate-100 dark:border-slate-800">
                <div className="p-3 bg-slate-100/70 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400 block">Utilisasi Tim</Text>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-xl font-bold text-slate-800 dark:text-slate-100">
                            {summary.overallTeamUtilization}%
                        </span>
                        <Progress
                            percent={summary.overallTeamUtilization}
                            showInfo={false}
                            size="small"
                            strokeColor={summary.overallTeamUtilization > 85 ? '#ef4444' : summary.overallTeamUtilization > 65 ? '#f59e0b' : '#3b82f6'}
                            className="w-16 m-0"
                        />
                    </div>
                </div>

                <div className="p-3 bg-slate-100/70 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400 block">Rata-rata Task / Anggota</Text>
                    <span className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1 block">
                        {summary.avgActiveTasks}
                    </span>
                </div>

                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/60 dark:border-emerald-800/50">
                    <Text className="text-[11px] text-emerald-700 dark:text-emerald-400 block">Siap Menerima Task (Available)</Text>
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

            {/* Filter Tabs by Workload Level */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 pb-2">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                    {[
                        { key: 'ALL', label: `Semua (${workloadList.length})` },
                        { key: 'LIGHT', label: `Light (${summary.lightCount})`, color: 'emerald' },
                        { key: 'OPTIMAL', label: `Optimal (${summary.optimalCount})`, color: 'blue' },
                        { key: 'HEAVY', label: `High Load (${summary.heavyCount})`, color: 'amber' },
                        { key: 'OVERLOADED', label: `Overloaded (${summary.overloadedCount})`, color: 'red' },
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

                {isLeader && summary.overloadedCount > 0 && (
                    <Tooltip title="Rekomendasi rebalancing otomatis task untuk anggota yang overloaded">
                        <Tag color="red" className="flex items-center gap-1 px-2.5 py-1 rounded-full cursor-pointer m-0">
                            <AlertOutlined /> {summary.overloadedCount} Perlu Rebalancing
                        </Tag>
                    </Tooltip>
                )}
            </div>

            {/* Members Capacity Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                {filteredList.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-slate-400 text-xs">
                        Tidak ada anggota dengan kriteria status ini.
                    </div>
                ) : (
                    filteredList.map((w) => (
                        <div
                            key={w.member.kodeku}
                            className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 hover:border-blue-400 dark:hover:border-blue-500 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <Avatar
                                            size={38}
                                            src={w.member.avatarUrl}
                                            icon={!w.member.avatarUrl && <UserOutlined />}
                                            className="bg-blue-100 text-blue-600 flex-shrink-0"
                                        />
                                        <div className="min-w-0">
                                            <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
                                                {w.member.nama}
                                            </div>
                                            <span className="text-[11px] text-slate-500 truncate block">
                                                {w.member.jabatan?.nama || 'Pegawai'}
                                            </span>
                                        </div>
                                    </div>

                                    <Tag
                                        color={w.level === 'LIGHT' ? 'green' : w.level === 'OPTIMAL' ? 'blue' : w.level === 'HEAVY' ? 'orange' : 'red'}
                                        className="m-0 text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                                    >
                                        {w.levelLabel}
                                    </Tag>
                                </div>

                                {/* Progress Capacity Bar */}
                                <div className="mt-3">
                                    <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                                        <span>Beban Task Aktif</span>
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                                            {w.activeTasks} / {CAPACITY_LIMIT_PER_MEMBER} task
                                        </span>
                                    </div>
                                    <Progress
                                        percent={w.capacityPercentage}
                                        showInfo={false}
                                        strokeColor={w.levelColor}
                                        size="small"
                                        className="m-0"
                                    />
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                                    <span>Pending: <b className="text-slate-600 dark:text-slate-300">{w.pendingTasks}</b></span>
                                    <span>In Progress: <b className="text-slate-600 dark:text-slate-300">{w.inProgressTasks}</b></span>
                                    <span>Selesai: <b className="text-emerald-600 dark:text-emerald-400">{w.completedTasks}</b></span>
                                </div>
                            </div>

                            {/* Leader Quick Actions */}
                            {isLeader && (
                                <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800 flex justify-end">
                                    <Button
                                        size="small"
                                        type="text"
                                        icon={<SwapOutlined />}
                                        onClick={() => setRebalanceMember(w)}
                                        disabled={w.activeTasks === 0}
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg"
                                    >
                                        Rebalance Task ({w.activeTasks})
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Rebalance Modal / Drawer */}
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
                width={560}
            >
                {rebalanceMember && (
                    <div className="py-2">
                        <Paragraph className="text-xs text-slate-500 mb-4">
                            Pilih tugas dari <b>{rebalanceMember.member.nama}</b> untuk dipindahkan ke anggota lain yang masih memiliki kapasitas yang memadai.
                        </Paragraph>

                        <div className="space-y-3 mb-5">
                            <Text className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                                1. Pilih Task yang Akan Dipindahkan:
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
                                    2. Pilih Penerima Tugas Baru (Assignee Baru):
                                </Text>
                                <Select
                                    placeholder="Pilih anggota yang tersedia..."
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

            {/* AI Workload Advisor Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-950/60 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <RobotOutlined className="text-base" />
                        </div>
                        <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-100 text-base">
                                AI Workload & Capacity Optimizer
                            </div>
                            <Text className="text-xs text-slate-500 dark:text-slate-400 font-normal block">
                                Analisis beban kerja berbasis AI untuk pencegahan burnout & pemerataan kapasitas tim
                            </Text>
                        </div>
                    </div>
                }
                open={isAiModalOpen}
                onCancel={() => setIsAiModalOpen(false)}
                footer={
                    <div className="flex justify-end">
                        <Button onClick={() => setIsAiModalOpen(false)}>Tutup</Button>
                    </div>
                }
                width={680}
            >
                <div className="py-2 space-y-4">
                    {/* Status Header */}
                    <div className="p-3.5 bg-gradient-to-r from-indigo-50/80 to-blue-50/80 dark:from-indigo-950/30 dark:to-blue-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <ThunderboltOutlined className="text-indigo-600 dark:text-indigo-400 text-xl" />
                            <div>
                                <div className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                                    Status Utilisasi Tim: {summary.overallTeamUtilization}%
                                </div>
                                <div className="text-[11px] text-indigo-700 dark:text-indigo-300">
                                    {summary.overloadedCount > 0
                                        ? `⚠️ Ada ${summary.overloadedCount} anggota terdeteksi overloaded.`
                                        : '✅ Beban kerja tim dalam batas aman.'}
                                </div>
                            </div>
                        </div>
                        <Tag color={summary.overallTeamUtilization > 80 ? 'red' : 'blue'} className="text-xs px-2.5 py-0.5 rounded-full font-semibold">
                            {summary.overallTeamUtilization > 80 ? 'HIGH RISK' : 'HEALTHY'}
                        </Tag>
                    </div>

                    {/* AI Narrative Analysis Card */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
                        <div className="flex items-center gap-2 mb-2 font-semibold text-xs text-slate-700 dark:text-slate-300">
                            <RocketOutlined className="text-blue-500" /> Analisis & Solusi AI Advisor:
                        </div>
                        {isAiAnalyzing ? (
                            <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
                                <Spin size="medium" />
                                <span>Menganalisis pola penugasan & kapasitas anggota tim...</span>
                            </div>
                        ) : (
                            <div className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                                {aiAnalysisResult || 'Menyiapkan rekomendasi AI...'}
                            </div>
                        )}
                    </div>

                    {/* AI Actionable Recommendations (1-Click Reassign) */}
                    <div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2.5 flex items-center gap-1.5">
                            <SwapOutlined className="text-indigo-500" />
                            Rekomendasi Redistribusi Tugas Otomatis (1-Click Action):
                        </div>

                        {aiReassignmentProposals.length === 0 ? (
                            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                                <CheckCircleOutlined className="text-emerald-500 text-base" />
                                Tidak ada penumpukan tugas kritis saat ini. Distribusi tugas anggota sudah proporsional.
                            </div>
                        ) : (
                            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                                {aiReassignmentProposals.map((prop) => (
                                    <div
                                        key={prop.taskId}
                                        className="p-3 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">
                                                {prop.taskTitle}
                                            </div>
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                                <span className="text-red-600 dark:text-red-400 font-medium">
                                                    {prop.fromMember.nama}
                                                </span>
                                                <span>➔</span>
                                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                                    {prop.toMember.nama}
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 italic mt-1">
                                                {prop.reason}
                                            </div>
                                        </div>

                                        <Button
                                            type="primary"
                                            size="small"
                                            icon={<SwapOutlined />}
                                            loading={executingAiTaskId === prop.taskId}
                                            onClick={() => handleApplyAiReassign(prop.taskId, prop.toMember.kodeku)}
                                            className="!bg-indigo-600 hover:!bg-indigo-500 !border-0 text-xs font-medium rounded-lg shrink-0"
                                        >
                                            Pindahkan
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </Card>
    );
}
