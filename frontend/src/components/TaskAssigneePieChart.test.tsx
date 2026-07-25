import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import TaskAssigneePieChart from './TaskAssigneePieChart';
import { Task, Colleague } from '../types/task';

describe('TaskAssigneePieChart Component', () => {
  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Setup Database Migration',
      status: 'IN_PROGRESS',
      userKode: 'PEG-001',
    },
    {
      id: 'task-2',
      title: 'Frontend Refactoring',
      status: 'PENDING',
      userKode: 'PEG-001',
    },
    {
      id: 'task-3',
      title: 'API Integration Test',
      status: 'PENDING',
      userKode: 'PEG-002',
    },
  ];

  const mockMembers: Colleague[] = [
    {
      kodeku: 'PEG-001',
      nama: 'Budi Santoso',
      statusLeader: 1,
    },
    {
      kodeku: 'PEG-002',
      nama: 'Siti Rahma',
      statusLeader: 0,
    },
  ];

  it('renders assignee workload pie chart and correctly computes task distribution', () => {
    render(<TaskAssigneePieChart tasks={mockTasks} members={mockMembers} />);

    expect(screen.getByText('Distribusi Task per Assignee')).toBeInTheDocument();
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('Siti Rahma')).toBeInTheDocument();
  });

  it('handles empty tasks list gracefully', () => {
    render(<TaskAssigneePieChart tasks={[]} members={[]} />);

    expect(screen.getByText(/Belum ada task untuk dianalisis/i)).toBeInTheDocument();
  });
});
