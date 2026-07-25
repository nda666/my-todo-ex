import React, { useState } from 'react';

import {
    Colleague,
    Me,
} from '../types/task';
import Sidebar from './Sidebar';

interface AutoHideSidebarWrapperProps {
    me: Me | null
    isLeader: boolean
    teamMembers: Colleague[]
    teamTaskCounts: Record<string, number>
    currentDivisiKode: number | null
    onCreateTask?: () => void
    onLogout: () => void
    stats: { total: number; pending: number; inProgress: number; completed: number }
}

export default function AutoHideSidebarWrapper(props: AutoHideSidebarWrapperProps) {
    const [hovered, setHovered] = useState(false)

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="relative z-50"
        >
            <Sidebar
                {...props}
                collapsed={!hovered}
            // selectedColleagueKode={null}
            // onSelectColleague={() => { }}
            />
        </div>
    )
}