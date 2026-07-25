import React from 'react';
import { Empty, Tag, Typography } from 'antd';
import { CalendarOutlined, UserOutlined } from '@ant-design/icons';
import { Colleague, Task } from '../types/task';

const { Title, Text } = Typography;

interface ProjectTimelineViewProps {
  tasks: Task[];
  members: Colleague[];
}

export default function ProjectTimelineView({ tasks, members }: ProjectTimelineViewProps) {
  return (
    <div className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-xl p-6">
      <Title level={5} className="!mb-4 !text-slate-800 dark:!text-slate-200">
        Timeline & Milestone Project
      </Title>
      {tasks.length === 0 ? (
        <Empty description="Tidak ada task untuk ditampilkan di timeline." />
      ) : (
        <div className="flex flex-col gap-4">
          {tasks.map((t) => {
            const assignee = members.find((m) => m.kodeku === t.userKode);
            return (
              <div
                key={t.id}
                className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{t.title}</span>
                    <Tag
                      color={
                        t.status === 'COMPLETED'
                          ? 'success'
                          : t.status === 'IN_PROGRESS'
                          ? 'processing'
                          : 'default'
                      }
                    >
                      {t.status}
                    </Tag>
                    {assignee && (
                      <Tag icon={<UserOutlined />} color="blue">
                        {assignee.nama}
                      </Tag>
                    )}
                  </div>
                  {t.description && (
                    <Text className="text-xs text-slate-500 block truncate max-w-xl">
                      {t.description}
                    </Text>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <CalendarOutlined />
                    <span>Dibuat: {new Date(t.createdAt).toLocaleDateString('id-ID')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
