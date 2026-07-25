import React from 'react';

import {
  Avatar,
  Badge,
} from 'antd';
import { useNavigate } from 'react-router-dom';

import {
  DownOutlined,
  RightOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';

import { useLocalStorageState } from '../hooks/useLocalStorageState';
import { Colleague } from '../types/task';

interface TeamMemberListProps {
    members: Colleague[]
    taskCounts: Record<string, number>
    divisiKode: number | null
}

export default function TeamMemberList({ members, taskCounts, divisiKode }: TeamMemberListProps) {
    const [isOpen, setIsOpen] = useLocalStorageState<boolean>('myteam_expanded', true)
    const navigate = useNavigate()

    return (
        <div className="flex flex-col gap-1">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between px-2 py-1 text-xs font-semibold !text-slate-400 dark:!text-slate-500 uppercase tracking-wider hover:!text-slate-700 dark:hover:!text-slate-200 transition-colors"
            >
                <span className="flex items-center gap-1.5">
                    <TeamOutlined /> My Team
                </span>
                {isOpen ? <DownOutlined className="text-[10px]" /> : <RightOutlined className="text-[10px]" />}
            </button>

            {isOpen && (
                <div className="flex flex-col gap-1 mt-1">
                    {members.length === 0 || !divisiKode ? (
                        <span className="px-2 text-xs italic !text-slate-400 dark:!text-slate-500">
                            Tidak ada pegawai lain di divisi ini.
                        </span>
                    ) : (
                        members.map((colleague) => {
                            const taskCount = taskCounts[colleague.kodeku] || 0
                            return (
                                <div
                                    key={colleague.kodeku}
                                    onClick={() => navigate(`/teams/${divisiKode}/${colleague.kodeku}`)}
                                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors !border !border-transparent hover:!bg-slate-100 dark:hover:!bg-slate-800/60"
                                >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <Avatar
                                            size={22}
                                            src={colleague.avatarUrl || undefined}
                                            icon={!colleague.avatarUrl && <UserOutlined />}
                                            className="!bg-slate-400 shrink-0"
                                        />
                                        <span className="text-sm truncate !text-slate-700 dark:!text-slate-300">
                                            {colleague.nama}
                                        </span>
                                        {colleague.statusLeader === 1 && (
                                            <span className="text-[10px] !text-slate-400 dark:!text-slate-500 shrink-0">Leader</span>
                                        )}
                                    </div>
                                    <Badge count={taskCount} color="#64748b" />
                                </div>
                            )
                        })
                    )}
                </div>
            )}
        </div>
    )
}