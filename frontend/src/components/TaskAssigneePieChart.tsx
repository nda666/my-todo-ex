import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';
import { Card, Empty, Tag, Typography, Tooltip as AntTooltip } from 'antd';
import { PieChartOutlined, UserOutlined } from '@ant-design/icons';
import { Colleague, Task } from '../types/task';

const { Title, Text } = Typography;

interface TaskAssigneePieChartProps {
  tasks: Task[];
  members: Colleague[];
  divisions?: any[];
}

interface AssigneeTaskData {
  userKode: string;
  name: string;
  divisionName: string;
  taskCount: number;
  percentage: number;
}

const COLOR_PALETTE = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#84CC16', // Lime
];

export default function TaskAssigneePieChart({
  tasks,
  members,
  divisions = [],
}: TaskAssigneePieChartProps) {
  const [activeSlice, setActiveSlice] = useState<AssigneeTaskData | null>(null);

  // Group tasks by assignee
  const assigneeData = useMemo(() => {
    if (!tasks || tasks.length === 0) return [];

    const memberMap = new Map<string, Colleague>();
    members.forEach((m) => {
      if (m.kodeku) {
        memberMap.set(m.kodeku, m);
      }
    });

    const divisionMap = new Map<number, string>();
    divisions.forEach((d) => {
      if (d.kode) {
        divisionMap.set(d.kode, d.nama);
      }
    });

    const countMap = new Map<string, number>();
    tasks.forEach((t) => {
      const key = t.userKode || 'UNASSIGNED';
      countMap.set(key, (countMap.get(key) || 0) + 1);
    });

    const totalTasks = tasks.length;
    const result: AssigneeTaskData[] = [];

    countMap.forEach((count, kode) => {
      if (kode === 'UNASSIGNED') {
        result.push({
          userKode: 'UNASSIGNED',
          name: 'Belum Ditugaskan',
          divisionName: '-',
          taskCount: count,
          percentage: Math.round((count / totalTasks) * 100),
        });
      } else {
        const member = memberMap.get(kode);
        const memberAny = member as any;
        const name = member?.nama || `User (${kode})`;
        let divName = '-';
        if (memberAny?.pegawai?.divisi?.nama) {
          divName = memberAny.pegawai.divisi.nama;
        } else if (memberAny?.pegawai?.divisi?.kode) {
          divName = divisionMap.get(memberAny.pegawai.divisi.kode) || `Divisi ${memberAny.pegawai.divisi.kode}`;
        }

        result.push({
          userKode: kode,
          name,
          divisionName: divName,
          taskCount: count,
          percentage: Math.round((count / totalTasks) * 100),
        });
      }
    });

    // Sort descending by task count
    return result.sort((a, b) => b.taskCount - a.taskCount);
  }, [tasks, members, divisions]);

  // D3 Pie Setup
  const width = 240;
  const height = 240;
  const radius = Math.min(width, height) / 2;
  const innerRadius = radius * 0.55; // Donut chart style

  const pieGenerator = useMemo(() => {
    return d3
      .pie<AssigneeTaskData>()
      .value((d) => d.taskCount)
      .sort(null);
  }, []);

  const arcGenerator = useMemo(() => {
    return d3
      .arc<d3.PieArcDatum<AssigneeTaskData>>()
      .innerRadius(innerRadius)
      .outerRadius(radius - 8)
      .cornerRadius(4);
  }, [innerRadius, radius]);

  const activeArcGenerator = useMemo(() => {
    return d3
      .arc<d3.PieArcDatum<AssigneeTaskData>>()
      .innerRadius(innerRadius)
      .outerRadius(radius + 2)
      .cornerRadius(4);
  }, [innerRadius, radius]);

  const colorScale = useMemo(() => {
    return d3
      .scaleOrdinal<string>()
      .domain(assigneeData.map((d) => d.userKode))
      .range(COLOR_PALETTE);
  }, [assigneeData]);

  const pieArcs = useMemo(() => {
    return pieGenerator(assigneeData);
  }, [pieGenerator, assigneeData]);

  if (tasks.length === 0 || assigneeData.length === 0) {
    return (
      <div className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-xl p-6">
        <Title level={5} className="!mb-4 !text-slate-800 dark:!text-slate-200 flex items-center gap-2">
          <PieChartOutlined className="text-blue-500" /> Distribusi Beban Kerja Tim
        </Title>
        <Empty description="Belum ada task untuk dianalisis distribusinya." />
      </div>
    );
  }

  return (
    <div className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <Title level={5} className="!mb-1 !text-slate-800 dark:!text-slate-200 flex items-center gap-2">
            <PieChartOutlined className="text-blue-500" /> Distribusi Task per Assignee
          </Title>
          <Text className="text-xs text-slate-500">
            Visualisasi proporsi beban kerja anggota tim across divisi
          </Text>
        </div>
        <Tag color="blue" className="px-3 py-1 text-xs rounded-full">
          Total Task: {tasks.length}
        </Tag>
      </div>

      <div className="flex flex-col lg:flex-row items-center justify-around gap-6 pt-2">
        {/* D3 SVG Pie Chart */}
        <div className="relative flex justify-center items-center">
          <svg width={width} height={height} className="overflow-visible">
            <g transform={`translate(${width / 2}, ${height / 2})`}>
              {pieArcs.map((arc, index) => {
                const isHovered = activeSlice?.userKode === arc.data.userKode;
                const pathD = (isHovered ? activeArcGenerator(arc) : arcGenerator(arc)) || '';
                const fillColor = colorScale(arc.data.userKode);

                return (
                  <path
                    key={arc.data.userKode || index}
                    d={pathD}
                    fill={fillColor}
                    opacity={activeSlice && !isHovered ? 0.6 : 1}
                    className="transition-all duration-200 cursor-pointer stroke-white dark:stroke-slate-900 stroke-2"
                    onMouseEnter={() => setActiveSlice(arc.data)}
                    onMouseLeave={() => setActiveSlice(null)}
                  />
                );
              })}
            </g>
          </svg>

          {/* Center Donut Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            {activeSlice ? (
              <div>
                <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {activeSlice.taskCount} Task
                </span>
                <span className="block text-xs text-slate-500 font-medium truncate max-w-[100px]">
                  {activeSlice.name}
                </span>
              </div>
            ) : (
              <div>
                <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {assigneeData.length}
                </span>
                <span className="block text-xs text-slate-500 font-medium">
                  Assignee
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Legend / Breakdown */}
        <div className="flex-1 w-full max-h-[220px] overflow-y-auto pr-2 flex flex-col gap-2">
          {assigneeData.map((item) => {
            const isHovered = activeSlice?.userKode === item.userKode;
            const itemColor = colorScale(item.userKode);

            return (
              <div
                key={item.userKode}
                className={`flex items-center justify-between p-2 rounded-lg text-xs transition-colors cursor-pointer border ${
                  isHovered
                    ? 'bg-blue-50 dark:bg-slate-800 border-blue-200 dark:border-slate-700'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                onMouseEnter={() => setActiveSlice(item)}
                onMouseLeave={() => setActiveSlice(null)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: itemColor }}
                  />
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                      {item.name}
                    </span>
                    <span className="text-[11px] text-slate-500 block truncate">
                      {item.divisionName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {item.taskCount} task
                  </span>
                  <Tag className="m-0 text-[10px] font-medium" color="blue">
                    {item.percentage}%
                  </Tag>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
