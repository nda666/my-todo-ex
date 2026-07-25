import React, {
  useEffect,
  useState,
} from 'react';

import {
  Button,
  DatePicker,
  Input,
  Select,
  Typography,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';

import {
  ClearOutlined,
  DownOutlined,
  FilterOutlined,
  LoadingOutlined,
  SearchOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { useQuery } from '@apollo/client';

import { useDebounce } from '../hooks/useDebounce';
import { GET_PROJECTS } from '../lib/queries';
import { Project } from '../types/project';

const { RangePicker } = DatePicker;
const { Text } = Typography;

interface TaskSearchFilterProps {
  search: string;
  onSearchChange: (val: string) => void;
  startDate: string | null;
  dueDate: string | null;
  onDateRangeChange: (startDate: string | null, dueDate: string | null) => void;
  projectId: string | null;
  onProjectIdChange: (projId: string | null) => void;
  onReset: () => void;
  loading?: boolean;
}

export default function TaskSearchFilter({
  search,
  onSearchChange,
  startDate,
  dueDate,
  onDateRangeChange,
  projectId,
  onProjectIdChange,
  onReset,
  loading = false,
}: TaskSearchFilterProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [localSearch, setLocalSearch] = useState(search);

  // Debounce input search key dengan delay 350ms
  const debouncedSearch = useDebounce(localSearch, 350);

  // Sinkronisasi jika ada perubahan reset dari parent
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Kirim hasil debounce ke parent component
  useEffect(() => {
    if (debouncedSearch !== search) {
      onSearchChange(debouncedSearch);
    }
  }, [debouncedSearch, onSearchChange, search]);

  const { data: projectsData, loading: loadingProjects } = useQuery(GET_PROJECTS);
  const projects: Project[] = projectsData?.projects || [];

  const dateRangeValue: [Dayjs | null, Dayjs | null] = [
    startDate ? dayjs(startDate) : null,
    dueDate ? dayjs(dueDate) : null,
  ];

  const hasAdvancedFilters = !!(startDate || dueDate || projectId);
  const isDebouncing = localSearch !== debouncedSearch;
  const isSearching = isDebouncing || loading;

  const handleReset = () => {
    setLocalSearch('');
    onReset();
  };

  return (
    <div className="mb-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm transition-all">
      {/* Keyword Search (Selalu Tampil) */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Cari task berdasarkan judul atau deskripsi..."
          prefix={
            isSearching ? (
              <LoadingOutlined className="text-blue-500 animate-spin" />
            ) : (
              <SearchOutlined className="text-slate-400" />
            )
          }
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          allowClear
          className="rounded-lg flex-1"
          size="large"
        />

        <Button
          type={hasAdvancedFilters ? 'primary' : 'default'}
          ghost={hasAdvancedFilters}
          onClick={() => setCollapsed(!collapsed)}
          icon={<FilterOutlined />}
          size="large"
          className="rounded-lg flex items-center gap-1"
        >
          <span>Filter</span>
          {collapsed ? <DownOutlined className="text-xs" /> : <UpOutlined className="text-xs" />}
        </Button>

        {(localSearch || hasAdvancedFilters) && (
          <Button
            type="text"
            onClick={handleReset}
            icon={<ClearOutlined />}
            size="large"
            className="rounded-lg text-slate-500 hover:text-red-500"
            title="Reset Search & Filter"
          >
            Reset
          </Button>
        )}
      </div>

      {/* Advanced Filters (Hidden / Collapsed) */}
      {!collapsed && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 animate-fadeIn">
          <div>
            <Text className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
              Rentang Tanggal (Mulai / Selesai)
            </Text>
            <RangePicker
              value={dateRangeValue}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  onDateRangeChange(dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD'));
                } else if (dates && dates[0]) {
                  onDateRangeChange(dates[0].format('YYYY-MM-DD'), null);
                } else if (dates && dates[1]) {
                  onDateRangeChange(null, dates[1].format('YYYY-MM-DD'));
                } else {
                  onDateRangeChange(null, null);
                }
              }}
              format="DD/MM/YYYY"
              placeholder={['Mulai', 'Selesai']}
              className="w-full rounded-lg"
            />
          </div>

          <div>
            <Text className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
              Project
            </Text>
            <Select
              placeholder="Filter berdasarkan Project"
              value={projectId}
              onChange={(val) => onProjectIdChange(val || null)}
              allowClear
              loading={loadingProjects}
              options={[
                { label: 'Semua Project', value: null },
                ...projects.map((p) => ({
                  label: p.name,
                  value: p.id,
                })),
              ]}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
