export type WorkflowStepStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface ProjectWorkflowStep {
    id: string;
    projectId: string;
    parentId?: string | null;
    title: string;
    description?: string | null;
    divisiKode?: number | null;
    status: WorkflowStepStatus;
    sortOrder: number;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    children: ProjectWorkflowStep[];
}

export interface CreateProjectWorkflowStepInput {
    projectId: string;
    parentId?: string | null;
    title: string;
    description?: string;
    divisiKode?: number;
    status?: WorkflowStepStatus;
}

export interface UpdateProjectWorkflowStepInput {
    title?: string;
    description?: string;
    divisiKode?: number;
    status?: WorkflowStepStatus;
}
