import React, { useState, useEffect } from 'react';
import { Avatar, Button, Divider, Popover, Tooltip, Typography, Segmented, Badge } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  HomeOutlined,
  ProjectOutlined,
  TeamOutlined,
  SettingOutlined,
  PlusOutlined,
  LogoutOutlined,
  UserOutlined,
  ApartmentOutlined,
  TableOutlined,
  ThunderboltOutlined,
  InteractionOutlined,
  RightOutlined,
  CheckSquareOutlined,
  PushpinOutlined,
} from '@ant-design/icons';
import { Me, Colleague } from '../types/task';
import TaskStats from './TaskStats';
import TeamMemberList from './TeamMemberList';
import ThemeSelector from './ThemeSelector';

const { Title, Text } = Typography;

export type SidebarTabKey = 'task' | 'project' | 'teams' | 'settings';
export type TriggerMode = 'click' | 'hover';

interface CombinedSidebarProps {
  me: Me | null;
  isLeader?: boolean;
  teamMembers?: Colleague[];
  teamTaskCounts?: Record<string, number>;
  currentDivisiKode?: number | null;
  stats?: { total: number; pending: number; inProgress: number; completed: number };
  onCreateTask?: () => void;
  onLogout: () => void;
  collapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
  onNavigate?: () => void;
}

export default function CombinedSidebar({
  me,
  isLeader = false,
  teamMembers = [],
  teamTaskCounts = {},
  currentDivisiKode = null,
  stats,
  onCreateTask,
  onLogout,
  collapsed = false,
  onToggleCollapse,
  onNavigate,
}: CombinedSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Load trigger mode from xv_user_settings local storage
  const [triggerMode, setTriggerMode] = useState<TriggerMode>(() => {
    try {
      const saved = localStorage.getItem('xv_user_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.sidebarTriggerMode) return parsed.sidebarTriggerMode;
      }
    } catch (e) {
      // fallback
    }
    return 'hover';
  });

  // Determine initial active tab based on current route
  const getTabFromPath = (path: string): SidebarTabKey => {
    if (path.startsWith('/projects')) return 'project';
    if (path.startsWith('/teams')) return 'teams';
    if (path.startsWith('/settings')) return 'settings';
    return 'task';
  };

  const [activeTab, setActiveTab] = useState<SidebarTabKey>(() => getTabFromPath(location.pathname));
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setActiveTab(getTabFromPath(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (collapsed) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (collapsed) {
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHovered(false);
      }, 150);
    }
  };

  const handleNavigate = (path: string, state?: any) => {
    onNavigate?.();
    if (collapsed) {
      setIsHovered(false);
    }
    if (state) {
      navigate(path, state);
    } else {
      navigate(path);
    }
  };

  // Handle saving setting to xv_user_settings
  const handleTriggerModeChange = (mode: TriggerMode) => {
    setTriggerMode(mode);
    try {
      const existing = localStorage.getItem('xv_user_settings');
      const parsed = existing ? JSON.parse(existing) : {};
      parsed.sidebarTriggerMode = mode;
      localStorage.setItem('xv_user_settings', JSON.stringify(parsed));
    } catch (e) {
      console.error('Failed to save to xv_user_settings', e);
    }
  };

  const handleTabClick = (tab: SidebarTabKey) => {
    setActiveTab(tab);
    if (collapsed) {
      setIsHovered(true);
    }

    // Direct navigation if applicable
    if (tab === 'task' && location.pathname !== '/') {
      handleNavigate('/');
    } else if (tab === 'project' && !location.pathname.startsWith('/projects')) {
      handleNavigate('/projects');
    } else if (tab === 'teams' && !location.pathname.startsWith('/teams')) {
      handleNavigate('/teams');
    } else if (tab === 'settings' && location.pathname !== '/settings') {
      handleNavigate('/settings', { state: { backgroundLocation: location } });
    }
  };

  const handleTabHover = (tab: SidebarTabKey) => {
    setActiveTab(tab);
    if (collapsed) {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      setIsHovered(true);
    }
  };

  const tabsConfig = [
    { key: 'task' as SidebarTabKey, label: 'Task', icon: <CheckSquareOutlined /> },
    { key: 'teams' as SidebarTabKey, label: 'Teams', icon: <TeamOutlined /> },
    { key: 'project' as SidebarTabKey, label: 'Project', icon: <ProjectOutlined /> },
    { key: 'settings' as SidebarTabKey, label: 'Setting', icon: <SettingOutlined /> },
  ];

  return (
    <div
      className="flex h-screen sticky top-0 z-50 select-none relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 1. PRIMARY VERTICAL RAIL (Far left vertical tabs, 64px wide) */}
      <div className="w-16 bg-slate-900 border-r border-slate-800 flex flex-col justify-between items-center py-3 z-20 shrink-0">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div
            onClick={() => handleNavigate('/')}
            className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center font-extrabold text-base shadow-md cursor-pointer transition-transform active:scale-95"
            title="Doran Todo Workspace"
          >
            DT
          </div>

          <Divider className="my-1 !border-slate-800 w-8 min-w-0" />

          {/* Rail Navigation Tabs */}
          <div className="flex flex-col gap-2">
            {tabsConfig.map((t) => {
              const isCurrent = activeTab === t.key;
              const isActive = isCurrent && (!collapsed || isHovered);
              return (
                <Tooltip key={t.key} title={t.label} placement="right">
                  <button
                    onClick={() => handleTabClick(t.key)}
                    onMouseEnter={() => handleTabHover(t.key)}
                    className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer relative ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold'
                        : isCurrent
                        ? 'bg-slate-800 text-blue-400 font-semibold border border-blue-500/30'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="text-xl">{t.icon}</span>
                    <span className="text-xs font-medium mt-0.5 leading-none">{t.label}</span>
                    {isActive && (
                      <span className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-400 rounded-l-full" />
                    )}
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Bottom Rail Controls */}
        <div className="flex flex-col items-center gap-3">
          {/* Trigger Mode Settings Selector */}
          <Popover
            trigger="click"
            placement="rightBottom"
            content={
              <div className="p-2 w-56">
                <div className="font-semibold text-xs text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                  <InteractionOutlined className="text-blue-500" /> Mode Trigger Tab Sidebar
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  Atur cara membuka menu tab sidebar (disimpan di <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded">xv_user_settings</code>)
                </p>
                <Segmented
                  block
                  size="small"
                  value={triggerMode}
                  onChange={(val) => handleTriggerModeChange(val as TriggerMode)}
                  options={[
                    { label: 'Hover⚡', value: 'hover' },
                    { label: 'Click 👆', value: 'click' },
                  ]}
                />
              </div>
            }
          >
            <Tooltip title={`Trigger Mode: ${triggerMode.toUpperCase()} (Klik untuk ubah)`} placement="right">
              <button className="w-9 h-9 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center text-xs transition-colors">
                {triggerMode === 'hover' ? <ThunderboltOutlined className="text-amber-400" /> : <InteractionOutlined className="text-blue-400" />}
              </button>
            </Tooltip>
          </Popover>

          {/* Profile Avatar */}
          <Tooltip title={me?.pegawai?.nama || me?.username || 'User'} placement="right">
            <Avatar
              size="small"
              src={me?.avatarUrl || undefined}
              icon={!me?.avatarUrl && <UserOutlined />}
              onClick={() => handleNavigate('/settings', { state: { backgroundLocation: location } })}
              className="bg-blue-600 text-white cursor-pointer hover:opacity-80 transition-opacity"
            />
          </Tooltip>
        </div>
      </div>

      {/* 2. SECONDARY SUBMENU PANEL (224px wide) */}
      <div
        className={`w-56 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-screen overflow-y-auto flex flex-col justify-between p-3.5 transition-all duration-200 ${
          collapsed
            ? `absolute left-16 top-0 z-50 shadow-2xl shadow-slate-900/30 dark:shadow-black/70 ${
                isHovered
                  ? 'opacity-100 visible pointer-events-auto translate-x-0'
                  : 'opacity-0 invisible pointer-events-none -translate-x-2'
              }`
            : 'relative shrink-0 shadow-sm opacity-100 visible'
        }`}
      >
        <div className="flex flex-col gap-4">
          {/* Header section based on tab */}
          {activeTab === 'task' && (
            <>
              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                    Workspace
                  </span>
                  <Title level={5} className="!mb-0 font-bold text-slate-800 dark:text-slate-100">
                    Task
                  </Title>
                </div>
                <div className="flex items-center gap-1">
                  {collapsed && onToggleCollapse && (
                    <Tooltip title="Sematkan sidebar agar tetap terbuka" placement="bottom">
                      <Button
                        type="text"
                        size="small"
                        icon={<PushpinOutlined className="text-slate-400 hover:text-blue-500" />}
                        onClick={() => {
                          onToggleCollapse(false);
                          setIsHovered(false);
                        }}
                        className="rounded-lg text-xs"
                      />
                    </Tooltip>
                  )}
                  {onCreateTask && (
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        if (collapsed) setIsHovered(false);
                        onCreateTask();
                      }}
                      className="rounded-lg text-xs"
                    >
                      Baru
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1 pt-1">
                <Button
                  type={location.pathname === '/' ? 'primary' : 'text'}
                  icon={<HomeOutlined />}
                  onClick={() => handleNavigate('/')}
                  className="w-full !justify-start rounded-lg font-medium text-xs"
                >
                  Task Saya
                </Button>

                <Button
                  type={location.pathname.includes('/team-board') ? 'primary' : 'text'}
                  icon={<TableOutlined />}
                  onClick={() => currentDivisiKode && handleNavigate(`/teams/${currentDivisiKode}/team-board`)}
                  disabled={!currentDivisiKode}
                  className="w-full !justify-start rounded-lg font-medium text-xs"
                >
                  Task Tim Saya
                </Button>
              </div>

              {stats && (
                <div className="pt-2">
                  <Divider className="my-2 !border-slate-100 dark:!border-slate-800" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                    Statistik Task
                  </span>
                  <TaskStats {...stats} />
                </div>
              )}

              {teamMembers.length > 0 && (
                <div className="pt-2">
                  <Divider className="my-2 !border-slate-100 dark:!border-slate-800" />
                  <TeamMemberList
                    members={teamMembers}
                    taskCounts={teamTaskCounts}
                    divisiKode={currentDivisiKode}
                  />
                </div>
              )}
            </>
          )}

          {activeTab === 'project' && (
            <>
              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                    Hub Project
                  </span>
                  <Title level={5} className="!mb-0 font-bold text-slate-800 dark:text-slate-100">
                    Projects
                  </Title>
                </div>
                <div className="flex items-center gap-1">
                  {collapsed && onToggleCollapse && (
                    <Tooltip title="Sematkan sidebar agar tetap terbuka" placement="bottom">
                      <Button
                        type="text"
                        size="small"
                        icon={<PushpinOutlined className="text-slate-400 hover:text-blue-500" />}
                        onClick={() => {
                          onToggleCollapse(false);
                          setIsHovered(false);
                        }}
                        className="rounded-lg text-xs"
                      />
                    </Tooltip>
                  )}
                  {isLeader && (
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => handleNavigate('/projects')}
                      className="rounded-lg text-xs"
                    >
                      Buat
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1 pt-1">
                <Button
                  type={location.pathname === '/projects' ? 'primary' : 'text'}
                  icon={<ProjectOutlined />}
                  onClick={() => handleNavigate('/projects')}
                  className="w-full !justify-start rounded-lg font-medium text-xs"
                >
                  Semua Project
                </Button>
              </div>

              <Divider className="my-2 !border-slate-100 dark:!border-slate-800" />
              <div className="bg-blue-50 dark:bg-slate-800/60 p-3 rounded-xl border border-blue-100 dark:border-slate-700/80">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 block mb-1">
                  Kolaborasi Proyek
                </span>
                <Text className="text-xs text-slate-600 dark:text-slate-400 leading-snug block">
                  Kelola pengerjaan proyek lintas divisi, tahapan stage (Planning, In Progress, Review, Done) & pembagian tugas.
                </Text>
              </div>
            </>
          )}

          {activeTab === 'teams' && (
            <>
              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                    Organisasi
                  </span>
                  <Title level={5} className="!mb-0 font-bold text-slate-800 dark:text-slate-100">
                    Tim & Divisi
                  </Title>
                </div>
                {collapsed && onToggleCollapse && (
                  <Tooltip title="Sematkan sidebar agar tetap terbuka" placement="bottom">
                    <Button
                      type="text"
                      size="small"
                      icon={<PushpinOutlined className="text-slate-400 hover:text-blue-500" />}
                      onClick={() => {
                        onToggleCollapse(false);
                        setIsHovered(false);
                      }}
                      className="rounded-lg text-xs"
                    />
                  </Tooltip>
                )}
              </div>

              <div className="flex flex-col gap-1 pt-1">
                {currentDivisiKode && (
                  <>
                    <Button
                      type={location.pathname === `/teams/${currentDivisiKode}` ? 'primary' : 'text'}
                      icon={<TeamOutlined />}
                      onClick={() => handleNavigate(`/teams/${currentDivisiKode}`)}
                      className="w-full !justify-start rounded-lg font-medium text-xs"
                    >
                      Divisi Saya
                    </Button>

                    <Button
                      type={location.pathname === `/teams/${currentDivisiKode}/team-board` ? 'primary' : 'text'}
                      icon={<TableOutlined />}
                      onClick={() => handleNavigate(`/teams/${currentDivisiKode}/team-board`)}
                      className="w-full !justify-start rounded-lg font-medium text-xs"
                    >
                      Team Board Saya
                    </Button>
                  </>
                )}

                <Button
                  type={location.pathname === '/teams' ? 'primary' : 'text'}
                  icon={<ApartmentOutlined />}
                  onClick={() => handleNavigate('/teams')}
                  className="w-full !justify-start rounded-lg font-medium text-xs"
                >
                  Semua Divisi
                </Button>
              </div>
            </>
          )}

          {activeTab === 'settings' && (
            <>
              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                    Konfigurasi
                  </span>
                  <Title level={5} className="!mb-0 font-bold text-slate-800 dark:text-slate-100">
                    Pengaturan
                  </Title>
                </div>
                {collapsed && onToggleCollapse && (
                  <Tooltip title="Sematkan sidebar agar tetap terbuka" placement="bottom">
                    <Button
                      type="text"
                      size="small"
                      icon={<PushpinOutlined className="text-slate-400 hover:text-blue-500" />}
                      onClick={() => {
                        onToggleCollapse(false);
                        setIsHovered(false);
                      }}
                      className="rounded-lg text-xs"
                    />
                  </Tooltip>
                )}
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Mode Sidebar Trigger
                  </span>
                  <Segmented
                    block
                    size="small"
                    value={triggerMode}
                    onChange={(val) => handleTriggerModeChange(val as TriggerMode)}
                    options={[
                      { label: 'Hover⚡', value: 'hover' },
                      { label: 'Click 👆', value: 'click' },
                    ]}
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tema Tampilan
                  </span>
                  <ThemeSelector size="small" />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom logout section */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
          <Button
            type="text"
            danger
            icon={<LogoutOutlined />}
            onClick={onLogout}
            className="w-full rounded-lg text-xs font-medium py-1.5 flex items-center justify-center gap-1.5 border border-dashed border-red-200 dark:border-red-950/40 hover:bg-red-50 dark:hover:bg-red-950/10"
          >
            Keluar Akun
          </Button>
        </div>
      </div>
    </div>
  );
}
