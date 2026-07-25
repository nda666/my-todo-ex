import React from 'react';

import {
  AuditOutlined,
  BankOutlined,
  BarChartOutlined,
  BgColorsOutlined,
  CustomerServiceOutlined,
  InboxOutlined,
  LaptopOutlined,
  SettingOutlined,
  SoundOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons';

const ICON_MAP: Record<string, React.ReactNode> = {
  laptop: <LaptopOutlined />,
  wallet: <WalletOutlined />,
  team: <TeamOutlined />,
  megaphone: <SoundOutlined />,
  scale: <AuditOutlined />,
  gear: <SettingOutlined />,
  chart: <BarChartOutlined />,
  brush: <BgColorsOutlined />,
  headset: <CustomerServiceOutlined />,
  box: <InboxOutlined />,
  building: <BankOutlined />,
}

export function getDivisionIcon(iconKey: string): React.ReactNode {
  return ICON_MAP[iconKey] || <BankOutlined />
}