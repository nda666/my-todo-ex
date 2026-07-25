import React from 'react';

import { Layout } from 'antd';

const { Content } = Layout

export default function GuestLayout({ children }: { children: React.ReactNode }) {
    return (
        <Layout className="min-h-screen !bg-slate-50 dark:!bg-slate-950 flex items-center justify-center">
            <Content className="w-full max-w-md p-6">
                {children}
            </Content>
        </Layout>
    )
}