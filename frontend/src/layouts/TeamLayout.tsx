import React, {
    createContext,
    useCallback,
    useContext,
    useState,
} from 'react';

import {
    Button,
    Drawer,
    Layout,
    Typography,
} from 'antd';
import {
    Outlet,
    useNavigate,
} from 'react-router-dom';

import {
    ArrowLeftOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
} from '@ant-design/icons';

import TeamsPageSidebar from '../components/TeamsPageSidebar';
import ThemeSelector from '../components/ThemeSelector';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { useLocalStorageState } from '../hooks/useLocalStorageState';

const { Header, Content } = Layout
const { Title } = Typography

const SIDEBAR_WIDTH = 260

interface TeamPageHeader {
    title: string
    onBack?: () => void
    headerExtra?: React.ReactNode
}

interface TeamLayoutContextValue {
    setPageHeader: (header: TeamPageHeader) => void
}

const TeamLayoutContext = createContext<TeamLayoutContextValue | null>(null)

/**
 * Dipanggil dari halaman anak (lewat <Outlet />) untuk mengisi judul/tombol back/
 * aksi kanan di header TeamLayout tanpa perlu membungkus dirinya sendiri dengan layout.
 *
 * PENTING: `onBack` dan `headerExtra` sebaiknya di-memoize (useCallback/useMemo) di
 * pemanggil, supaya effect ini tidak jalan ulang di setiap render halaman.
 */
export function useTeamHeader(header: TeamPageHeader) {
    const ctx = useContext(TeamLayoutContext)
    if (!ctx) {
        throw new Error('useTeamHeader harus dipanggil di dalam route TeamLayout')
    }
    const { title, onBack, headerExtra } = header
    React.useEffect(() => {
        ctx.setPageHeader({ title, onBack, headerExtra })
    }, [title, onBack, headerExtra])
}

interface TeamLayoutProps {
    wide?: boolean
    storageKey?: string
    defaultCollapsed?: boolean
}

export default function TeamLayout({
    wide = false,
    storageKey = 'team_sidebar_collapsed',
    defaultCollapsed = false,
}: TeamLayoutProps) {
    const { me, logout } = useAuth()
    const navigate = useNavigate()
    const isMobile = useIsMobile()
    const [collapsed, setCollapsed] = useLocalStorageState<boolean>(storageKey, defaultCollapsed)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [pageHeader, setPageHeader] = useState<TeamPageHeader>({ title: '' })

    const currentDivisiKode = me?.pegawai?.divisi?.kode || null
    // useScrollRestoration()

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

    // Referensi stabil - jadi value context tidak berubah antar render TeamLayout sendiri
    const setPageHeaderStable = useCallback((h: TeamPageHeader) => setPageHeader(h), [])

    return (
        <Layout className="!min-h-screen !bg-slate-50 dark:!bg-slate-950">

            {!isMobile && (
                <div
                    className="fixed top-0 left-0 h-screen z-50 transition-all duration-200"
                    style={{ width: collapsed ? 0 : SIDEBAR_WIDTH }}
                >
                    <TeamsPageSidebar
                        me={me}
                        collapsed={collapsed}
                        currentDivisiKode={currentDivisiKode}
                        onLogout={handleLogout}
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
                    <TeamsPageSidebar
                        me={me}
                        collapsed={false}
                        currentDivisiKode={currentDivisiKode}
                        onLogout={handleLogout}
                    />
                </Drawer>
            )}

            <Layout
                className="transition-all duration-200"
                style={{ marginLeft: !isMobile && !collapsed ? SIDEBAR_WIDTH : 0 }}
            >
                <Header className="!bg-white dark:!bg-slate-900 !border-b !border-slate-200 dark:!border-slate-800 px-3 sm:px-6 flex items-center justify-between h-16 sticky top-0 z-40">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <Button
                            type="text"
                            icon={collapsed || isMobile ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                            onClick={toggleSidebar}
                            className="text-lg w-10 h-10 flex items-center justify-center !bg-slate-50 dark:!bg-slate-950 !border !border-slate-100 dark:!border-slate-800 rounded-lg shrink-0"
                        />
                        {pageHeader.onBack && (
                            <Button type="text" icon={<ArrowLeftOutlined />} onClick={pageHeader.onBack} className="shrink-0" />
                        )}
                        <Title level={4} className="!mb-0 font-bold tracking-tight !text-slate-800 dark:!text-slate-100 truncate">
                            {pageHeader.title}
                        </Title>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {pageHeader.headerExtra}
                        <ThemeSelector size="small" />
                    </div>
                </Header>

                <Content className={wide ? 'p-3 sm:p-6 flex flex-col' : 'flex flex-col max-w-5xl w-full mx-auto p-3 sm:p-6'}>
                    <TeamLayoutContext.Provider value={{ setPageHeader: setPageHeaderStable }}>
                        <Outlet />
                    </TeamLayoutContext.Provider>
                </Content>
            </Layout>
        </Layout>
    )
}