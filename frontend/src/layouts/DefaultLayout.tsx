import React from 'react';

import {
    Button,
    Drawer,
    Layout,
    Typography,
} from 'antd';
import { useNavigate } from 'react-router-dom';

import {
    LogoutOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
} from '@ant-design/icons';

import Sidebar from '../components/Sidebar';
import ThemeSelector from '../components/ThemeSelector';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import { Colleague } from '../types/task';

const { Header, Content } = Layout
const { Title } = Typography

const SIDEBAR_WIDTH = 280

interface DefaultLayoutProps {
    title: string
    teamMembers: Colleague[]
    teamTaskCounts: Record<string, number>
    stats: { total: number; pending: number; inProgress: number; completed: number }
    onCreateTask?: () => void
    children: React.ReactNode
}

export default function DefaultLayout({ title, teamMembers, teamTaskCounts, stats, onCreateTask, children }: DefaultLayoutProps) {
    const { me, logout } = useAuth()
    const navigate = useNavigate()
    const isMobile = useIsMobile()
    const [collapsed, setCollapsed] = useLocalStorageState<boolean>('default_sidebar_collapsed', false)
    const [mobileOpen, setMobileOpen] = React.useState(false)

    const isLeader = me?.pegawai?.statusLeader === 1
    const currentDivisiKode = me?.pegawai?.divisi?.kode || null

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    const toggleSidebar = () => {
        if (isMobile) {
            setMobileOpen((v) => !v)
        } else {
            setCollapsed(!collapsed)
        }
    }

    const sidebarContent = (
        <Sidebar
            me={me}
            isLeader={isLeader}
            collapsed={false}
            teamMembers={teamMembers}
            teamTaskCounts={teamTaskCounts}
            currentDivisiKode={currentDivisiKode}
            onCreateTask={() => {
                setMobileOpen(false)
                onCreateTask?.()
            }}
            onLogout={handleLogout}
            stats={stats}
        />
    )

    return (
        <Layout className="min-h-screen !bg-slate-50 dark:!bg-slate-950 transition-colors duration-200">
            {!isMobile && (
                <div
                    className="fixed top-0 left-0 h-screen z-50 transition-all duration-200"
                    style={{ width: collapsed ? 0 : SIDEBAR_WIDTH }}
                >
                    <Sidebar
                        me={me}
                        isLeader={isLeader}
                        collapsed={collapsed}
                        teamMembers={teamMembers}
                        teamTaskCounts={teamTaskCounts}
                        currentDivisiKode={currentDivisiKode}
                        onCreateTask={onCreateTask}
                        onLogout={handleLogout}
                        stats={stats}
                    />
                </div>
            )}

            {isMobile && (
                <Drawer
                    placement="left"
                    open={mobileOpen}
                    onClose={() => setMobileOpen(false)}
                    width={SIDEBAR_WIDTH}
                    closable={false}
                    bodyStyle={{ padding: 0 }}
                >
                    {sidebarContent}
                </Drawer>
            )}

            <Layout
                className="transition-all duration-200"
                style={{ marginLeft: !isMobile && !collapsed ? SIDEBAR_WIDTH : 0 }}
            >
                <Header className="!bg-white dark:!bg-slate-900 !border-b !border-slate-200 dark:!border-slate-800 px-3 sm:px-6 py-4 flex items-center justify-between h-16 sticky top-0 z-40">
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        <Button
                            type="text"
                            icon={collapsed || isMobile ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                            onClick={toggleSidebar}
                            className="text-lg w-10 h-10 flex items-center justify-center !bg-slate-50 dark:!bg-slate-950 !border !border-slate-100 dark:!border-slate-800 rounded-lg shrink-0"
                        />
                        <Title level={4} className="!mb-0 font-bold tracking-tight !text-slate-800 dark:!text-slate-100 truncate">
                            {title}
                        </Title>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <ThemeSelector size="small" />
                        <Button type="primary" danger shape="circle" icon={<LogoutOutlined />} onClick={handleLogout} />
                    </div>
                </Header>

                <Content className="max-w-4xl w-full mx-auto p-3 sm:p-6">
                    {children}
                </Content>
            </Layout>
        </Layout>
    )
}