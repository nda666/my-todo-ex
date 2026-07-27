import React, { useCallback, useMemo, useState } from 'react';

import {
    Avatar,
    Tag,
    message,
    Spin,
} from 'antd';
import {
    useNavigate,
    useParams,
} from 'react-router-dom';

import {
    CrownFilled,
    UserOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery } from '@apollo/client';

import CreateTaskModal from '../components/CreateTaskModal';
import TeamBoardColumn from '../components/TeamBoardColumn';
import { useAuth } from '../contexts/AuthContext';
import { useTeamHeader } from '../layouts/TeamLayout';
import { CREATE_TASK, GET_COLLEAGUES_BY_DIVISI, GET_TASKS } from '../lib/queries';
import { Colleague, Task } from '../types/task';
import { getWorkloadInfo } from '../components/WorkloadCapacityWidget';

export default function TeamBoard() {
    const { me } = useAuth()
    const navigate = useNavigate()
    const { divisiId } = useParams<{ divisiId: string }>()
    const divisiKode = Number(divisiId)
    const [quickAssignUserKode, setQuickAssignUserKode] = useState<string | null>(null)

    const isLeader = me?.pegawai?.statusLeader === 1

    const handleBack = useCallback(
        () => navigate(`/teams/${divisiKode}`, { preventScrollReset: true }),
        [navigate, divisiKode]
    )
    useTeamHeader({ title: 'Task Tim — Semua Anggota', onBack: handleBack })

    const { data, loading } = useQuery(GET_COLLEAGUES_BY_DIVISI, {
        variables: { divisiKode },
        skip: !divisiKode,
    })
    const members: Colleague[] = data?.colleaguesByDivisi || []

    const { data: tasksData } = useQuery(GET_TASKS, {
        variables: { limit: 200 },
        fetchPolicy: 'cache-and-network',
    })
    const teamTasks: Task[] = tasksData?.tasks?.tasks || []

    // Map user active tasks
    const activeTaskCountMap = useMemo(() => {
        const map = new Map<string, number>()
        teamTasks.forEach((t) => {
            if (t.status !== 'COMPLETED' && t.userKode) {
                map.set(t.userKode, (map.get(t.userKode) || 0) + 1)
            }
        })
        return map
    }, [teamTasks])

    const [createTaskMutation, { loading: creatingTask }] = useMutation(CREATE_TASK)

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
                    }
                }
            })
            message.success('Task berhasil dibuat dan ditugaskan')
            setQuickAssignUserKode(null)
        } catch (err: any) {
            message.error(err.message || 'Gagal menugaskan task')
        }
    }

    return (
        <>
            {loading ? (
                <div className="flex justify-center py-20"><Spin size="large" /></div>
            ) : (
                <div className="flex flex-1 gap-4 overflow-x-auto pb-4" style={{ scrollSnapType: 'x proximity' }}>
                    {members.map((m: any) => {
                        const activeCount = activeTaskCountMap.get(m.kodeku) || 0;
                        const workload = getWorkloadInfo(activeCount);
                        return (
                            <div key={m.kodeku} style={{ scrollSnapAlign: 'start' }} className="shrink-0 w-[85vw] max-w-[320px]">
                                <div
                                    onClick={() => navigate(`/teams/${divisiKode}/${m.kodeku}`)}
                                    className="flex items-center justify-between mb-3 px-1 cursor-pointer group"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Avatar size={28} src={m.avatarUrl || undefined} icon={!m.avatarUrl && <UserOutlined />} className="!bg-blue-500 flex-shrink-0" />
                                        <span className="font-semibold !text-slate-800 dark:!text-slate-100 group-hover:!text-blue-600 truncate">
                                            {m.nama}
                                        </span>
                                        {m.statusLeader === 1 && <CrownFilled className="!text-amber-500 text-xs flex-shrink-0" />}
                                    </div>
                                    <Tag color={workload.tagColor} className="m-0 text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
                                        {activeCount} Task
                                    </Tag>
                                </div>
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

            <CreateTaskModal
                open={!!quickAssignUserKode}
                onCancel={() => setQuickAssignUserKode(null)}
                onCreate={handleCreateTaskForMember}
                loading={creatingTask}
                assignees={members}
            />
        </>
    )
}