import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import UpcomingTasksCard from './UpcomingTasksCard';
import { Task } from '../types/task';

describe('UpcomingTasksCard Component', () => {
  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Desain Wireframe Mobile App',
      status: 'IN_PROGRESS',
      dueDate: new Date().toISOString(), // Due today
      userKode: 'U100',
    },
    {
      id: 'task-2',
      title: 'Review PR Backend Service',
      status: 'PENDING',
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // Due in 2 days
      userKode: 'U101',
    },
    {
      id: 'task-3',
      title: 'Sudah Selesai',
      status: 'COMPLETED',
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      userKode: 'U100',
    },
  ];

  it('renders summary card title and filters non-completed upcoming tasks', () => {
    render(<UpcomingTasksCard tasks={mockTasks} />);
    
    expect(screen.getByText('Tugas Mendatang (7 Hari Ke Depan)')).toBeInTheDocument();
    expect(screen.getByText('Desain Wireframe Mobile App')).toBeInTheDocument();
    expect(screen.getByText('Review PR Backend Service')).toBeInTheDocument();
    expect(screen.queryByText('Sudah Selesai')).not.toBeInTheDocument();
  });

  it('displays empty state when no upcoming tasks are due within 7 days', () => {
    render(<UpcomingTasksCard tasks={[]} />);
    expect(screen.getByText(/Tidak ada tugas yang tenggat/i)).toBeInTheDocument();
  });
});
