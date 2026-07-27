import React, { useMemo, useState } from 'react';

import {
    Alert,
    Avatar,
    Badge,
    Button,
    Card,
    Empty,
    Input,
    Popover,
    Progress,
    Radio,
    Space,
    Tag,
    Tooltip,
    Typography,
} from 'antd';

import {
    AlertOutlined,
    CalendarOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    DisconnectOutlined,
    ExclamationCircleOutlined,
    FilterOutlined,
    LinkOutlined,
    LockOutlined,
    SearchOutlined,
    UserOutlined,
} from '@ant-design/icons';

import { Colleague, Task } from '../types/task';
import { getTaskDependencies } from '../utils/taskDependencies';

const { Title, Text, Paragraph } = Typography;

interface ProjectTimelineViewProps {
    tasks: Task[];
    members: Colleague[];
    onTaskClick?: (task: Task) => void;
}

export default function ProjectTimelineView({ tasks, members, onTaskClick }: ProjectTimelineViewProps) {
    const [filterBlockedOnly, setFilterBlockedOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewStyle, setViewStyle] = useState<'GANTT' | 'LIST'>('GANTT');

    // Calculate dates range for Gantt timeline
    const timelineMeta = useMemo(() => {
        if (!tasks || tasks.length === 0) return { minDate: new Date(), maxDate: new Date(), totalDays: 30 };

        let minTime = Infinity;
        let maxTime = -Infinity;

        tasks.forEach((t) => {
            const start = t.startDate ? new Date(t.startDate).getTime() : new Date(t.createdAt).getTime();
            const due = t.dueDate ? new Date(t.dueDate).getTime() : start + 7 * 24 * 60 * 60 * 1000;

            if (start < minTime) minTime = start;
            if (due > maxTime) maxTime = due;
        });

        if (minTime === Infinity) minTime = Date.now();
        if (maxTime === -Infinity || maxTime <= minTime) maxTime = minTime + 30 * 24 * 60 * 60 * 1000;

        // Add 2 days padding
        minTime -= 2 * 24 * 60 * 60 * 1000;
        maxTime += 5 * 24 * 60 * 60 * 1000;

        const totalDays = Math.max(Math.ceil((maxTime - minTime) / (1000 * 60 * 60 * 24)), 7);

        return {
            minDate: new Date(minTime),
            maxDate: new Date(maxTime),
            minTime,
            maxTime,
            totalDays,
        };
    }, [tasks]);

    // Process tasks with dependency analysis
    const processedTasks = useMemo(() => {
        return tasks.map((t) => {
            const depInfo = getTaskDependencies(t, tasks);
            const assignee = members.find((m) => m.kodeku === t.userKode);

            // Timeline bar math
            const startT = t.startDate ? new Date(t.startDate).getTime() : new Date(t.createdAt).getTime();
            const dueT = t.dueDate ? new Date(t.dueDate).getTime() : startT + 5 * 24 * 60 * 60 * 1000;

            const leftOffsetPct = Math.max(
                0,
                Math.min(
                    100,
                    ((startT - timelineMeta.minTime) / (timelineMeta.maxTime - timelineMeta.minTime)) * 100
                )
            );

            const durationPct = Math.max(
                4,
                Math.min(
                    100 - leftOffsetPct,
                    ((dueT - startT) / (timelineMeta.maxTime - timelineMeta.minTime)) * 100
                )
            );

            return {
                task: t,
                depInfo,
                assignee,
                leftOffsetPct,
                durationPct,
                startDateStr: new Date(startT).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
                dueDateStr: new Date(dueT).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
            };
        });
    }, [tasks, members, timelineMeta]);

    // Filter tasks
    const filteredTasks = useMemo(() => {
        return processedTasks.filter(({ task, depInfo }) => {
            if (filterBlockedOnly && !depInfo.isBlocked) return false;
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchTitle = task.title.toLowerCase().includes(query);
                const matchDesc = task.description?.toLowerCase().includes(query);
                if (!matchTitle && !matchDesc) return false;
            }
            return true;
        });
    }, [processedTasks, filterBlockedOnly, searchQuery]);

    const blockedTasksCount = useMemo(() => processedTasks.filter((p) => p.depInfo.isBlocked).length, [processedTasks]);

    return (
        <Card className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-2xl shadow-sm">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                    <Title level={5} className="!mb-1 !text-slate-800 dark:!text-slate-100 flex items-center gap-2">
                        <CalendarOutlined className="text-blue-500" /> Timeline & Task Dependencies (Gantt)
                    </Title>
                    <Text className="text-xs !text-slate-500 dark:!text-slate-400">
                        Visualisasi jadwal project & relasi blocker antar-task.
                    </Text>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        placeholder="Cari task..."
                        prefix={<SearchOutlined className="text-slate-400" />}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        size="small"
                        className="w-40 rounded-lg text-xs"
                    />

                    <Button
                        size="small"
                        type={filterBlockedOnly ? 'primary' : 'default'}
                        danger={filterBlockedOnly || blockedTasksCount > 0}
                        icon={<LockOutlined />}
                        onClick={() => setFilterBlockedOnly(!filterBlockedOnly)}
                        className="text-xs rounded-lg"
                    >
                        Blocked ({blockedTasksCount})
                    </Button>

                    <Radio.Group
                        size="small"
                        value={viewStyle}
                        onChange={(e) => setViewStyle(e.target.value)}
                        optionType="button"
                        buttonStyle="solid"
                    >
                        <Radio.Button value="GANTT">Gantt</Radio.Button>
                        <Radio.Button value="LIST">List</Radio.Button>
                    </Radio.Group>
                </div>
            </div>

            {/* Blocked Summary Banner */}
            {blockedTasksCount > 0 && !filterBlockedOnly && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center justify-between gap-3 text-xs text-red-700 dark:text-red-300">
                    <div className="flex items-center gap-2">
                        <ExclamationCircleOutlined className="text-red-500 text-base flex-shrink-0" />
                        <span>
                            Terdapat <b>{blockedTasksCount} task terhalang (blocked)</b> oleh task lain yang belum selesai.
                        </span>
                    </div>
                    <Button
                        size="small"
                        danger
                        type="link"
                        onClick={() => setFilterBlockedOnly(true)}
                        className="text-xs font-semibold p-0 h-auto"
                    >
                        Lihat Task Blocked
                    </Button>
                </div>
            )}

            {/* Timeline View Body */}
            {filteredTasks.length === 0 ? (
                <div className="py-12">
                    <Empty description={<span className="text-slate-400 text-xs">Tidak ada task dalam timeline filter ini.</span>} />
                </div>
            ) : viewStyle === 'GANTT' ? (
                /* --- GANTT TIMELINE VIEW --- */
                <div className="mt-5 overflow-x-auto">
                    {/* Gantt Header Scale */}
                    <div className="min-w-[650px]">
                        <div className="grid grid-cols-12 gap-2 pb-2 text-[11px] font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                            <div className="col-span-4">TASK & ASSIGNEE</div>
                            <div className="col-span-8 flex justify-between px-2">
                                <span>{timelineMeta.minDate.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}</span>
                                <span>TIMELINE JADWAL</span>
                                <span>{timelineMeta.maxDate.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}</span>
                            </div>
                        </div>

                        {/* Task Rows */}
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {filteredTasks.map(({ task, depInfo, assignee, leftOffsetPct, durationPct, startDateStr, dueDateStr }) => {
                                const isBlocked = depInfo.isBlocked;
                                const isCompleted = task.status === 'COMPLETED';

                                return (
                                    <div
                                        key={task.id}
                                        onClick={() => onTaskClick && onTaskClick(task)}
                                        className={`grid grid-cols-12 gap-2 py-3 px-1 items-center hover:bg-slate-50/80 dark:hover:bg-slate-850/50 transition-colors cursor-pointer rounded-lg ${
                                            isBlocked ? 'bg-red-50/40 dark:bg-red-950/20 border-l-4 border-l-red-500' : ''
                                        }`}
                                    >
                                        {/* Left Side: Task Info */}
                                        <div className="col-span-4 pr-2 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {isBlocked && (
                                                    <Tooltip
                                                        title={
                                                            <div className="text-xs p-1">
                                                                <b className="text-red-400 block mb-1">TERHALANG (BLOCKED)!</b>
                                                                <span>Task ini menunggu penyelesaian dari:</span>
                                                                <ul className="list-disc pl-4 mt-1">
                                                                    {depInfo.activeBlockers.map((b) => (
                                                                        <li key={b.id}>{b.title}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        }
                                                    >
                                                        <Tag color="red" className="m-0 text-[10px] font-bold px-1.5 py-0 rounded flex items-center gap-1">
                                                            <LockOutlined /> BLOCKED
                                                        </Tag>
                                                    </Tooltip>
                                                )}

                                                <span
                                                    className={`font-semibold text-xs truncate max-w-[180px] ${
                                                        isBlocked
                                                            ? 'text-red-600 dark:text-red-400'
                                                            : isCompleted
                                                            ? 'line-through text-slate-400'
                                                            : 'text-slate-800 dark:text-slate-200'
                                                    }`}
                                                >
                                                    {task.title}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                                                {assignee ? (
                                                    <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 truncate">
                                                        <Avatar size={16} src={assignee.avatarUrl} icon={!assignee.avatarUrl && <UserOutlined />} className="bg-blue-400" />
                                                        <span className="truncate max-w-[100px]">{assignee.nama}</span>
                                                    </span>
                                                ) : (
                                                    <span className="italic text-slate-300">Unassigned</span>
                                                )}

                                                {depInfo.dependsOnTasks.length > 0 && (
                                                    <Popover
                                                        content={
                                                            <div className="text-xs max-w-xs space-y-1">
                                                                <div className="font-semibold text-slate-700">Depends On ({depInfo.dependsOnTasks.length}):</div>
                                                                {depInfo.dependsOnTasks.map((dt) => (
                                                                    <div key={dt.id} className="flex items-center gap-1.5 text-slate-600">
                                                                        <Tag color={dt.status === 'COMPLETED' ? 'green' : 'orange'} className="text-[9px] m-0">
                                                                            {dt.status}
                                                                        </Tag>
                                                                        <span>{dt.title}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        }
                                                    >
                                                        <Tag icon={<LinkOutlined />} color="purple" className="m-0 text-[10px] cursor-pointer px-1 py-0">
                                                            {depInfo.dependsOnTasks.length} Dep
                                                        </Tag>
                                                    </Popover>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right Side: Gantt Bar Track */}
                                        <div className="col-span-8 relative h-7 bg-slate-100/60 dark:bg-slate-800/40 rounded-lg overflow-hidden flex items-center px-1">
                                            {/* Bar Element */}
                                            <div
                                                style={{
                                                    left: `${leftOffsetPct}%`,
                                                    width: `${durationPct}%`,
                                                }}
                                                className={`absolute h-5 rounded-md px-2 flex items-center justify-between text-[10px] font-semibold transition-all shadow-sm ${
                                                    isBlocked
                                                        ? 'bg-red-500 text-white shadow-red-200 border border-red-600 animate-pulse'
                                                        : isCompleted
                                                        ? 'bg-emerald-500 text-white'
                                                        : task.status === 'IN_PROGRESS'
                                                        ? 'bg-blue-500 text-white'
                                                        : 'bg-amber-400 text-slate-900'
                                                }`}
                                            >
                                                <span className="truncate pr-1">{startDateStr}</span>
                                                <span className="truncate">{dueDateStr}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ) : (
                /* --- LIST VIEW WITH DEPENDENCIES --- */
                <div className="mt-5 space-y-3">
                    {filteredTasks.map(({ task, depInfo, assignee }) => {
                        const isBlocked = depInfo.isBlocked;

                        return (
                            <div
                                key={task.id}
                                onClick={() => onTaskClick && onTaskClick(task)}
                                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                                    isBlocked
                                        ? 'bg-red-50/50 dark:bg-red-950/20 border-red-300 dark:border-red-900/60 shadow-sm'
                                        : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {isBlocked && (
                                            <Tag color="red" className="m-0 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <LockOutlined /> BLOCKED
                                            </Tag>
                                        )}

                                        <span className={`font-semibold text-sm ${isBlocked ? 'text-red-700 dark:text-red-300' : 'text-slate-800 dark:text-slate-100'}`}>
                                            {task.title}
                                        </span>

                                        <Tag color={task.status === 'COMPLETED' ? 'green' : task.status === 'IN_PROGRESS' ? 'blue' : 'amber'} className="m-0 text-xs">
                                            {task.status}
                                        </Tag>

                                        {assignee && (
                                            <Tag icon={<UserOutlined />} color="cyan" className="m-0 text-xs">
                                                {assignee.nama}
                                            </Tag>
                                        )}
                                    </div>

                                    {task.dueDate && (
                                        <Text className="text-xs text-slate-400 flex items-center gap-1">
                                            <ClockCircleOutlined /> Tenggat: {new Date(task.dueDate).toLocaleDateString('id-ID')}
                                        </Text>
                                    )}
                                </div>

                                {/* Blocker Details Alert */}
                                {isBlocked && (
                                    <div className="mt-3 p-2.5 bg-red-100/70 dark:bg-red-900/40 border border-red-200 dark:border-red-800/50 rounded-lg text-xs text-red-800 dark:text-red-200">
                                        <div className="font-semibold flex items-center gap-1 mb-1">
                                            <ExclamationCircleOutlined /> Terhalang oleh task yang belum selesai:
                                        </div>
                                        <ul className="list-disc pl-5 space-y-0.5">
                                            {depInfo.activeBlockers.map((b) => (
                                                <li key={b.id}>
                                                    <b>{b.title}</b> (Status: <Tag color="amber" className="m-0 text-[10px]">{b.status}</Tag>)
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
}
