import React from 'react';
import { Empty, Tag, Timeline, Typography } from 'antd';
import { ProjectStage, STAGE_COLORS, STAGE_LABELS } from '../types/project';

const { Title, Text } = Typography;

interface StageHistoryItem {
  fromStage: string;
  toStage: string;
  changedBy: string;
  changedAt: string;
  note?: string;
}

interface ProjectActivityTrailProps {
  stageHistory?: StageHistoryItem[];
}

export default function ProjectActivityTrail({ stageHistory }: ProjectActivityTrailProps) {
  return (
    <div className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-xl p-6">
      <Title level={5} className="!mb-4 !text-slate-800 dark:!text-slate-200">
        Riwayat Perubahan & Audit Trail
      </Title>
      {stageHistory && stageHistory.length > 0 ? (
        <Timeline
          items={stageHistory.map((sh) => ({
            children: (
              <div className="mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag color={STAGE_COLORS[sh.fromStage as ProjectStage]}>
                    {STAGE_LABELS[sh.fromStage as ProjectStage] || sh.fromStage}
                  </Tag>
                  <span>→</span>
                  <Tag color={STAGE_COLORS[sh.toStage as ProjectStage]}>
                    {STAGE_LABELS[sh.toStage as ProjectStage] || sh.toStage}
                  </Tag>
                  <Text className="text-xs text-slate-400">{sh.changedAt}</Text>
                </div>
                <Text className="text-xs text-slate-500 block mt-1">
                  Oleh: <span className="font-medium text-slate-700 dark:text-slate-300">{sh.changedBy}</span>
                  {sh.note && ` — Catatan: "${sh.note}"`}
                </Text>
              </div>
            ),
          }))}
        />
      ) : (
        <Empty description="Belum ada riwayat perubahan stage." />
      )}
    </div>
  );
}
