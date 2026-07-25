import React, { useMemo } from 'react';
import { Badge, Card, Tag, Typography, Empty, Tooltip } from 'antd';
import { CalendarOutlined, ClockCircleOutlined, ExclamationCircleOutlined, CheckCircleOutlined, RightOutlined } from '@ant-design/icons';
import { Task } from '../types/task';

const { Title, Text } = Typography;

interface UpcomingTasksCardProps {
  tasks: Task[];
  onSelectTask?: (task: Task) => void;
}

export default function UpcomingTasksCard({ tasks, onSelectTask }: UpcomingTasksCardProps) {
  const upcomingData = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
    
    const in7Days = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
    in7Days.setHours(23, 59, 59, 999);

    const upcomingTasks = tasks.filter((t) => {
      if (t.status === 'COMPLETED' || !t.dueDate) return false;
      const due = new Date(t.dueDate);
      return !isNaN(due.getTime()) && due >= startOfToday && due <= in7Days;
    });

    // Sort by due date ascending (earliest first)
    upcomingTasks.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

    let dueToday = 0;
    let due1To3Days = 0;
    let due4To7Days = 0;

    upcomingTasks.forEach((t) => {
      const due = new Date(t.dueDate!);
      if (due <= endOfToday) {
        dueToday++;
      } else if (due <= new Date(startOfToday.getTime() + 3 * 24 * 60 * 60 * 1000 - 1)) {
        due1To3Days++;
      } else {
        due4To7Days++;
      }
    });

    return {
      totalUpcoming: upcomingTasks.length,
      upcomingTasks,
      dueToday,
      due1To3Days,
      due4To7Days,
    };
  }, [tasks]);

  const formatDateLabel = (dueDateStr: string) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(dueDateStr);
    
    const diffTime = due.getTime() - startOfToday.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return { text: 'Hari ini', color: 'red' };
    } else if (diffDays === 1) {
      return { text: 'Besok', color: 'volcano' };
    } else {
      return { text: `${diffDays} hari lagi`, color: 'orange' };
    }
  };

  return (
    <div className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg">
            <CalendarOutlined />
          </div>
          <div>
            <Title level={5} className="!mb-0 font-bold text-slate-800 dark:text-slate-100">
              Tugas Mendatang (7 Hari Ke Depan)
            </Title>
            <Text className="text-xs text-slate-500 dark:text-slate-400">
              Ringkasan tenggat waktu tugas minggu ini
            </Text>
          </div>
        </div>

        <Badge
          count={upcomingData.totalUpcoming}
          overflowCount={99}
          style={{ backgroundColor: upcomingData.totalUpcoming > 0 ? '#f59e0b' : '#9ca3af' }}
          className="font-semibold text-xs"
        />
      </div>

      {/* Breakdown chips */}
      <div className="grid grid-cols-3 gap-2 my-3">
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-lg p-2.5 text-center">
          <span className="block text-xs font-medium text-red-600 dark:text-red-400">Hari Ini</span>
          <span className="text-lg font-extrabold text-red-700 dark:text-red-300">{upcomingData.dueToday}</span>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 rounded-lg p-2.5 text-center">
          <span className="block text-xs font-medium text-amber-600 dark:text-amber-400">1 - 3 Hari</span>
          <span className="text-lg font-extrabold text-amber-700 dark:text-amber-300">{upcomingData.due1To3Days}</span>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-lg p-2.5 text-center">
          <span className="block text-xs font-medium text-blue-600 dark:text-blue-400">4 - 7 Hari</span>
          <span className="text-lg font-extrabold text-blue-700 dark:text-blue-300">{upcomingData.due4To7Days}</span>
        </div>
      </div>

      {/* Task List Preview */}
      {upcomingData.totalUpcoming === 0 ? (
        <div className="py-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Tidak ada tugas yang tenggat dalam 7 hari ke depan. Kerjaan aman! 🎉
              </span>
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1">
          {upcomingData.upcomingTasks.map((task) => {
            const dateBadge = formatDateLabel(task.dueDate!);
            return (
              <div
                key={task.id}
                onClick={() => onSelectTask?.(task)}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <ClockCircleOutlined className="text-amber-500 text-xs shrink-0" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {task.title}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <Tag color={dateBadge.color} className="m-0 text-[10px] font-medium px-2 py-0.5 rounded-md">
                    {dateBadge.text}
                  </Tag>
                  <Tag
                    color={task.status === 'IN_PROGRESS' ? 'processing' : 'warning'}
                    className="m-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                  >
                    {task.status === 'IN_PROGRESS' ? 'Proses' : 'Pending'}
                  </Tag>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
