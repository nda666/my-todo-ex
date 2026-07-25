import React from 'react';

import {
  Avatar,
  Button,
  Divider,
  Layout,
  Typography,
} from 'antd';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  AppstoreOutlined,
  LogoutOutlined,
  PlusOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';

import {
  Colleague,
  Me,
} from '../types/task';
import TaskStats from './TaskStats';
import TeamMemberList from './TeamMemberList';
import ThemeSelector from './ThemeSelector';

const { Sider } = Layout
const { Title, Text } = Typography

interface SidebarProps {
    me: Me | null
    isLeader: boolean
    collapsed: boolean
    teamMembers: Colleague[]
    teamTaskCounts: Record<string, number>
    currentDivisiKode: number | null
    onCreateTask?: () => void
    onLogout: () => void
    stats: { total: number; pending: number; inProgress: number; completed: number }
}

export default function Sidebar({
    me,
    isLeader,
    collapsed,
    teamMembers,
    teamTaskCounts,
    currentDivisiKode,
    onCreateTask,
    onLogout,
    stats,
}: SidebarProps) {
    const navigate = useNavigate()
    const location = useLocation()

    return (
        <Sider
            trigger={null}
            collapsible
            collapsed={collapsed}
            breakpoint="lg"
            collapsedWidth="0"
            width={280}
            className="!bg-white dark:!bg-slate-900 !border-r !border-slate-200 dark:!border-slate-800 sticky top-0 h-screen z-50 flex flex-col "
        >

            <div className="flex flex-col h-full">
                <div className="flex items-center gap-3 h-16 px-6">
                    <div
                        onClick={() => navigate('/')}
                        className="!bg-blue-600 !text-white rounded-lg px-2.5 py-1.5 flex items-center justify-center font-bold text-lg shadow-sm cursor-pointer"
                    >
                        DT
                    </div>
                    {!collapsed && (
                        <div>
                            <Title level={4} className="!mb-0 font-bold tracking-tight !text-slate-800 dark:!text-slate-100">
                                Doran Todo
                            </Title>
                            <Text className="text-xs !text-slate-500 dark:!text-slate-400">
                                Workspace Anda
                            </Text>
                        </div>
                    )}
                </div>

                <div className='overflow-y-auto flex-1 px-2'>
                    {!collapsed && (
                        <div
                            onClick={() => navigate('/settings', { state: { backgroundLocation: location } })}
                            className="!bg-slate-50 dark:!bg-slate-950/40 !border !border-slate-100 dark:!border-slate-800/80 p-3.5 rounded-xl flex items-center gap-3 cursor-pointer hover:!bg-slate-100 dark:hover:!bg-slate-900 transition-colors"
                        >
                            <Avatar
                                size="large"
                                src={me?.avatarUrl || undefined}
                                icon={!me?.avatarUrl && <UserOutlined />}
                                className="!bg-blue-100 dark:!bg-blue-900 !text-blue-600 dark:!text-blue-200 shrink-0"
                            />
                            <div className="overflow-hidden leading-tight text-left">
                                <div className="font-semibold text-sm !text-slate-800 dark:!text-slate-200 truncate">
                                    {me?.pegawai?.nama || me?.username || 'User'}
                                </div>
                                {me?.pegawai ? (
                                    <div className="text-[10px] !text-slate-400 dark:!text-slate-500 truncate mt-0.5">
                                        {me.pegawai.jabatan?.nama || 'Pegawai'} • {me.pegawai.divisi?.nama || 'Divisi'}
                                        {isLeader && ' • Leader'}
                                    </div>
                                ) : (
                                    <div className="text-[10px] !text-slate-400 dark:!text-slate-500 mt-0.5">Online</div>
                                )}
                            </div>
                        </div>
                    )}




                    {!collapsed && (

                        <div className="flex flex-col gap-2">
                            {onCreateTask && (
                                <Button
                                    type="primary"
                                    size="large"
                                    icon={<PlusOutlined />}
                                    onClick={onCreateTask}
                                    className="w-full rounded-xl font-medium shadow-sm"
                                >
                                    Task Baru
                                </Button>
                            )}
                            <Button
                                icon={<TeamOutlined />}
                                onClick={() => currentDivisiKode && navigate(`/teams/${currentDivisiKode}/team-board`)}
                                className="w-full rounded-xl"
                                disabled={!currentDivisiKode}
                            >
                                Task Tim Saya
                            </Button>
                            <Button
                                icon={<AppstoreOutlined />}
                                onClick={() => navigate('/teams')}
                                className="w-full rounded-xl"
                            >
                                Semua Divisi
                            </Button>
                        </div>
                    )}

                    {!collapsed && (
                        <div className="flex flex-col gap-2">
                            <Divider className="my-1 !border-slate-100 dark:!border-slate-800" />
                            <div className="px-2 text-xs font-semibold !text-slate-400 dark:!text-slate-500 uppercase tracking-wider">
                                Statistik Tugas
                            </div>
                            <TaskStats {...stats} />
                        </div>
                    )}

                    {!collapsed && (
                        <div className="flex flex-col gap-2">
                            <Divider className="my-1 !border-slate-100 dark:!border-slate-800" />
                            <TeamMemberList
                                members={teamMembers}
                                taskCounts={teamTaskCounts}
                                divisiKode={currentDivisiKode}
                            />
                        </div>
                    )}
                </div>
                {!collapsed && (
                    <div className="flex flex-col gap-4 pt-4 !border-t !border-slate-100 dark:!border-slate-800">
                        <div className="flex justify-center">
                            <ThemeSelector size="small" />
                        </div>
                        <Button
                            type="text"
                            danger
                            icon={<LogoutOutlined />}
                            onClick={onLogout}
                            className="w-full text-left rounded-lg font-medium py-2 flex items-center justify-center gap-2 !border !border-dashed !border-red-200 dark:!border-red-950/40 hover:!bg-red-50 dark:hover:!bg-red-950/10"
                        >
                            Keluar Akun
                        </Button>
                    </div>
                )}
            </div>
        </Sider>
    )
}