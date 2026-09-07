import React, { useMemo, useState } from 'react';

import {
  Avatar,
  Badge,
  Button,
  Card,
  Drawer,
  Empty,
  Input,
  Radio,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd';

import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  FireOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useQuery, useSubscription } from '@apollo/client';

import { useAuth } from '../contexts/AuthContext';
import { TASK_EVENT_SUBSCRIPTION } from '../graphql/tasks';
import { applyTaskEventToCache } from '../lib/taskCacheUpdates';
import { GET_COLLEAGUES_BY_DIVISI, GET_TASKS } from '../lib/queries';
import { Colleague, Task } from '../types/task';

const { Text, Title } = Typography;

interface LiveTeamActivityStreamProps {
  open?: boolean;
  onClose?: () => void;
  divisiKode?: number;
  standalone?: boolean;
}

export default function LiveTeamActivityStream({
  open = true,
  onClose,
  divisiKode,
  standalone = false,
}: LiveTeamActivityStreamProps) {
  const { me } = useAuth();
  const effectiveDivisiKode = divisiKode || me?.pegawai?.divisi?.kode || me?.pegawai?.kodedivisi;

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED' | 'GIT'>('ALL');

  const {
    data: colleaguesData,
    loading: loadingColleagues,
    refetch: refetchColleagues,
  } = useQuery(GET_COLLEAGUES_BY_DIVISI, {
    variables: { divisiKode: effectiveDivisiKode },
    skip: !effectiveDivisiKode,
  });

  const {
    data: tasksData,
    loading: loadingTasks,
    refetch: refetchTasks,
  } = useQuery(GET_TASKS, {
    variables: { limit: 150 },
    fetchPolicy: 'cache-and-network',
  });

  useSubscription(TASK_EVENT_SUBSCRIPTION, {
    variables: { divisiKode: effectiveDivisiKode || undefined },
    skip: !effectiveDivisiKode,
    onData: ({ client, data }) => {
      applyTaskEventToCache(client.cache, data?.data?.taskEvent);
    },
  });

  const colleagues: Colleague[] = useMemo(
    () => colleaguesData?.colleaguesByDivisi || [],
    [colleaguesData]
  );

  const colleagueMap = useMemo(() => {
    const map = new Map<string, Colleague>();
    colleagues.forEach((c) => {
      map.set(c.kodeku, c);
    });
    return map;
  }, [colleagues]);

  const colleagueKodeSet = useMemo(() => {
    return new Set(colleagues.map((c) => c.kodeku));
  }, [colleagues]);

  const allTasks: Task[] = useMemo(() => {
    return tasksData?.tasks?.tasks || [];
  }, [tasksData]);

  // Filter task yang relevan dengan divisi ini
  const streamItems = useMemo(() => {
    let list = allTasks;

    // Jika ada data rekan divisi, prioritaskan task milik anggota divisi
    if (colleagueKodeSet.size > 0) {
      list = list.filter((t) => colleagueKodeSet.has(t.userKode));
    }

    // Urutkan dari yang paling baru diupdate / dibuat
    list = [...list].sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt).getTime();
      return timeB - timeA;
    });

    // Filter berdasarkan tipe status
    if (filterType === 'IN_PROGRESS') {
      list = list.filter((t) => t.status === 'IN_PROGRESS');
    } else if (filterType === 'COMPLETED') {
      list = list.filter((t) => t.status === 'COMPLETED');
    } else if (filterType === 'GIT') {
      list = list.filter((t) => t.meta?.some((m) => m.key === 'git_commit'));
    }

    // Filter pencarian
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => {
        const user = colleagueMap.get(t.userKode);
        const userName = user?.nama?.toLowerCase() || '';
        const title = t.title.toLowerCase();
        return title.includes(q) || userName.includes(q);
      });
    }

    return list;
  }, [allTasks, colleagueKodeSet, colleagueMap, filterType, search]);

  const inProgressCount = useMemo(
    () =>
      allTasks.filter(
        (t) => (colleagueKodeSet.size === 0 || colleagueKodeSet.has(t.userKode)) && t.status === 'IN_PROGRESS'
      ).length,
    [allTasks, colleagueKodeSet]
  );

  const completedTodayCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return allTasks.filter((t) => {
      if (colleagueKodeSet.size > 0 && !colleagueKodeSet.has(t.userKode)) return false;
      if (t.status !== 'COMPLETED') return false;
      const createdDate = t.createdAt ? t.createdAt.split('T')[0] : '';
      const updatedDate = t.updatedAt ? t.updatedAt.split('T')[0] : '';
      return createdDate === today || updatedDate === today;
    }).length;
  }, [allTasks, colleagueKodeSet]);

  const handleRefresh = () => {
    refetchColleagues();
    refetchTasks();
  };

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return '';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Baru saja';
    if (diffMin < 60) return `${diffMin}m lalu`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}j lalu`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay}h lalu`;
  };

  const content = (
    <div className="flex flex-col h-full space-y-4">
      {/* Metrics Header */}
      <div className="grid grid-cols-2 gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800/80 rounded-xl border border-blue-100 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            <ClockCircleOutlined />
          </div>
          <div>
            <div className="text-base font-bold text-gray-800 dark:text-gray-100 leading-tight">
              {inProgressCount} Task
            </div>
            <Text type="secondary" className="text-xs">
              Sedang Dikerjakan
            </Text>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            <CheckCircleOutlined />
          </div>
          <div>
            <div className="text-base font-bold text-gray-800 dark:text-gray-100 leading-tight">
              {completedTodayCount} Task
            </div>
            <Text type="secondary" className="text-xs">
              Selesai Hari Ini
            </Text>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Input
            placeholder="Cari anggota atau judul task..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            size="small"
            className="flex-1 rounded-md"
          />
          <Tooltip title="Muat ulang stream">
            <Button
              size="small"
              icon={<ReloadOutlined spin={loadingTasks} />}
              onClick={handleRefresh}
            />
          </Tooltip>
        </div>

        <Radio.Group
          size="small"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="w-full flex"
          buttonStyle="solid"
        >
          <Radio.Button value="ALL" className="flex-1 text-center text-xs">
            Semua
          </Radio.Button>
          <Radio.Button value="IN_PROGRESS" className="flex-1 text-center text-xs">
            In Progress
          </Radio.Button>
          <Radio.Button value="COMPLETED" className="flex-1 text-center text-xs">
            Selesai
          </Radio.Button>
          <Radio.Button value="GIT" className="flex-1 text-center text-xs">
            Git Hook
          </Radio.Button>
        </Radio.Group>
      </div>

      {/* Stream List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[260px] max-h-[380px]">
        {loadingTasks && streamItems.length === 0 ? (
          <div className="flex justify-center items-center h-48">
            <Spin size="default" />
          </div>
        ) : streamItems.length === 0 ? (
          <div className="py-8">
            <Empty description="Belum ada aktivitas di filter ini" />
          </div>
        ) : (
          streamItems.map((task) => {
            const user = colleagueMap.get(task.userKode);
            const gitMeta = task.meta?.find((m) => m.key === 'git_commit');

            return (
              <div
                key={task.id}
                className="p-3 bg-white dark:bg-gray-800/90 rounded-lg border border-gray-100 dark:border-gray-700/80 shadow-xs hover:border-blue-200 dark:hover:border-blue-800 transition-all space-y-2"
              >
                {/* Header: User + Status + Timestamp */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 min-w-0">
                    <Avatar
                      size={24}
                      src={user?.avatarUrl}
                      icon={<UserOutlined />}
                      className="bg-blue-600 flex-shrink-0"
                    />
                    <div className="truncate">
                      <span className="font-semibold text-xs text-gray-800 dark:text-gray-200">
                        {user ? user.nama : `User ${task.userKode}`}
                      </span>
                      {user?.jabatan?.nama && (
                        <span className="text-xs text-gray-400 ml-1.5 hidden sm:inline">
                          ({user.jabatan.nama})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 flex-shrink-0">
                    <Text type="secondary" className="text-xs">
                      {formatRelativeTime(task.updatedAt || task.createdAt)}
                    </Text>
                  </div>
                </div>

                {/* Task Title */}
                <div className="text-sm font-medium text-gray-800 dark:text-gray-100 pl-8 leading-snug">
                  {task.title}
                </div>

                {/* Badges Footer */}
                <div className="flex flex-wrap items-center gap-1.5 pl-8 pt-0.5">
                  {task.status === 'IN_PROGRESS' && (
                    <Tag color="processing" className="text-xs m-0">
                      Sedang Dikerjakan
                    </Tag>
                  )}
                  {task.status === 'COMPLETED' && (
                    <Tag color="success" className="text-xs m-0">
                      Selesai
                    </Tag>
                  )}
                  {task.status === 'PENDING' && (
                    <Tag color="default" className="text-xs m-0">
                      Rencana
                    </Tag>
                  )}

                  {gitMeta?.value && (
                    <Tag
                      color="purple"
                      icon={<CodeOutlined />}
                      className="text-xs m-0 font-mono"
                    >
                      {gitMeta.value}
                    </Tag>
                  )}

                  {task.priority === 'HIGH' && (
                    <Tag color="error" className="text-xs m-0">
                      HIGH
                    </Tag>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  if (standalone) {
    return (
      <Card
        title={
          <div className="flex items-center space-x-2">
            <ThunderboltOutlined className="text-amber-500 text-base" />
            <span className="font-semibold text-base">Aktivitas Tim Terkini (Realtime)</span>
            <Tag color="blue" className="text-xs">Live</Tag>
          </div>
        }
        className="shadow-sm rounded-xl"
        styles={{ body: { padding: '16px' } }}
      >
        {content}
      </Card>
    );
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-2">
          <ThunderboltOutlined className="text-amber-500 text-base" />
          <span className="font-semibold text-base">Live Activity Stream Tim</span>
          <Tag color="blue">Realtime</Tag>
        </div>
      }
      width={460}
      styles={{ body: { padding: '16px' } }}
      destroyOnClose
    >
      {content}
    </Drawer>
  );
}
