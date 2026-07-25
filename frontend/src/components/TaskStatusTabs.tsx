import React from 'react';

import { Tabs } from 'antd';

import { StatusTabKey } from '../utils/taskFilters';

interface TaskStatusTabsProps {
    activeKey: StatusTabKey
    onChange: (key: StatusTabKey) => void
    counts: { all: number; incomplete: number; progress: number; complete: number }
}

export default function TaskStatusTabs({ activeKey, onChange, counts }: TaskStatusTabsProps) {
    return (
        <Tabs
            activeKey={activeKey}
            onChange={(key) => onChange(key as StatusTabKey)}
            items={[
                { key: 'all', label: `All (${counts.all})` },
                { key: 'incomplete', label: `Incomplete (${counts.incomplete})` },
                { key: 'progress', label: `Progress (${counts.progress})` },
                { key: 'complete', label: `Complete (${counts.complete})` },
            ]}
        />
    )
}