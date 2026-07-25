import React from 'react';
import { Progress, Tag, Typography } from 'antd';

const { Title, Text } = Typography;

interface ProjectProgressCardProps {
  totalTasksCount: number;
  completedTasksCount: number;
  inProgressTasksCount: number;
  pendingTasksCount: number;
  progressPercentage: number;
}

export default function ProjectProgressCard({
  totalTasksCount,
  completedTasksCount,
  inProgressTasksCount,
  pendingTasksCount,
  progressPercentage,
}: ProjectProgressCardProps) {
  return (
    <div className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-xl p-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <Title level={5} className="!mb-1 !text-slate-800 dark:!text-slate-200">
            Progress Project
          </Title>
          <Text className="text-xs text-slate-500">
            {completedTasksCount} dari {totalTasksCount} task selesai ({progressPercentage}%)
          </Text>
        </div>
        <div className="flex flex-wrap gap-3">
          <Tag color="blue" className="px-3 py-1 text-xs rounded-full">
            Pending: {pendingTasksCount}
          </Tag>
          <Tag color="processing" className="px-3 py-1 text-xs rounded-full">
            In Progress: {inProgressTasksCount}
          </Tag>
          <Tag color="success" className="px-3 py-1 text-xs rounded-full">
            Selesai: {completedTasksCount}
          </Tag>
        </div>
      </div>
      <Progress
        percent={progressPercentage}
        status="active"
        strokeColor={{ '0%': '#10B981', '100%': '#3B82F6' }}
      />
    </div>
  );
}
