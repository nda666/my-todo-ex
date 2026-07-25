import React from 'react';

import {
    Avatar,
    Button,
    Layout,
    Typography,
} from 'antd';
import {
    useLocation,
    useNavigate,
} from 'react-router-dom';

import {
    ApartmentOutlined,
    HomeOutlined,
    LogoutOutlined,
    ProjectOutlined,
    SettingOutlined,
    TableOutlined,
    TeamOutlined,
    UserOutlined,
} from '@ant-design/icons';

import { Me } from '../types/task';
import ThemeSelector from './ThemeSelector';

const { Sider } = Layout
const { Title } = Typography

interface TeamsPageSidebarProps {
    me: Me | null
    collapsed: boolean
    currentDivisiKode: number | null
    onLogout: () => void
}

export default function TeamsPageSidebar({ me, collapsed, currentDivisiKode, onLogout }: TeamsPageSidebarProps) {
    const navigate = useNavigate()
    const location = useLocation()

    const navItems = [
        { icon: <HomeOutlined />, label: 'Task Saya', onClick: () => navigate('/') },
        { icon: <ProjectOutlined />, label: 'Project', onClick: () => navigate('/projects') },
        { icon: <ApartmentOutlined />, label: 'Semua Divisi', onClick: () => navigate('/teams') },
        {
            icon: <TeamOutlined />,
            label: 'Divisi Saya',
            onClick: () => currentDivisiKode && navigate(`/teams/${currentDivisiKode}`),
            disabled: !currentDivisiKode,
        },
        {
            icon: <TableOutlined />,
            label: 'Team Board Saya',
            onClick: () => currentDivisiKode && navigate(`/teams/${currentDivisiKode}/team-board`),
            disabled: !currentDivisiKode,
        },
    ]

    return (
        <Sider
            trigger={null}
            collapsible
            collapsed={collapsed}
            breakpoint="lg"
            collapsedWidth="0"
            width={260}
            className="!bg-white dark:!bg-slate-900 !border-r !border-slate-200 dark:!border-slate-800 h-screen overflow-y-auto"
        >
            <div className="flex flex-col h-full justify-between p-4">
                <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-3 px-2 py-2">
                        <div
                            onClick={() => navigate('/')}
                            className="!bg-blue-600 !text-white rounded-lg px-2.5 py-1.5 flex items-center justify-center font-bold text-lg shadow-sm cursor-pointer"
                        >
                            DT
                        </div>
                        {!collapsed && (
                            <Title level={4} className="!mb-0 font-bold tracking-tight !text-slate-800 dark:!text-slate-100">
                                Doran Todo
                            </Title>
                        )}
                    </div>

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
                                <div className="text-[10px] !text-slate-400 dark:!text-slate-500 truncate mt-0.5">
                                    {me?.pegawai?.divisi?.nama || 'Divisi'}
                                </div>
                            </div>
                        </div>
                    )}

                    {!collapsed && (
                        <div className="flex flex-col gap-1">
                            {navItems.map((item) => (
                                <Button
                                    key={item.label}
                                    icon={item.icon}
                                    onClick={item.onClick}
                                    disabled={item.disabled}
                                    className="w-full !justify-start rounded-lg font-medium"
                                    type="text"
                                >
                                    {item.label}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>

                {!collapsed && (
                    <div className="flex flex-col gap-3 pt-4 !border-t !border-slate-100 dark:!border-slate-800">
                        <Button
                            icon={<SettingOutlined />}
                            onClick={() => navigate('/settings', { state: { backgroundLocation: location } })}
                            type="text"
                            className="w-full !justify-start rounded-lg font-medium"
                        >
                            Pengaturan
                        </Button>
                        <div className="flex justify-center">
                            <ThemeSelector size="small" />
                        </div>
                        <Button
                            type="text"
                            danger
                            icon={<LogoutOutlined />}
                            onClick={onLogout}
                            className="w-full rounded-lg font-medium py-2 flex items-center justify-center gap-2 !border !border-dashed !border-red-200 dark:!border-red-950/40 hover:!bg-red-50 dark:hover:!bg-red-950/10"
                        >
                            Keluar Akun
                        </Button>
                    </div>
                )}
            </div>
        </Sider>
    )
}