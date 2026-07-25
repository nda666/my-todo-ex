import React from 'react'
import { Segmented } from 'antd'
import type { SizeType } from 'antd/es/config-provider/SizeContext'
import { SunOutlined, MoonOutlined, DesktopOutlined } from '@ant-design/icons'
import { useTheme } from '../contexts/ThemeContext'

export default function ThemeSelector({ size }: { size?: SizeType }) {
  const { themeMode, setThemeMode } = useTheme()

  return (
    <Segmented
      size={size}
      value={themeMode}
      onChange={(value) => setThemeMode(value)}
      options={[
        {
          label: 'Light',
          value: 'light',
          icon: <SunOutlined />,
        },
        {
          label: 'Dark',
          value: 'dark',
          icon: <MoonOutlined />,
        },
        {
          label: 'Default',
          value: 'default',
          icon: <DesktopOutlined />,
        },
      ]}
    />
  )
}
