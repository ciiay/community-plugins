/*
 * Copyright 2024 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { default as React } from 'react';
import LabelImportantIcon from '@mui/icons-material/LabelImportant';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import PendingOutlinedIcon from '@mui/icons-material/PendingOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import DoDisturbAltIcon from '@mui/icons-material/DoDisturbAlt';
import { ModerateIcon } from '../components/Servicenow/ModerateIcon';
import { InProgressIcon } from '../components/Servicenow/InProgressIcon';

import Typography from '@mui/material/Typography';

interface StatusData {
  Icon: React.ElementType;
  color: string;
  label: string;
  transform?: string;
}

const iconStyleBase = { marginRight: 4 };
const typographyStyleBase = { display: 'flex', alignItems: 'center' };

const PRIORITY_MAP: Record<number, StatusData> = {
  1: {
    Icon: LabelImportantIcon,
    color: '#C9190B',
    label: 'Critical',
    transform: 'rotate(-90deg)',
  },
  2: { Icon: KeyboardDoubleArrowUpIcon, color: '#C9190B', label: 'High' },
  3: { Icon: ModerateIcon, color: '#F0AB00', label: 'Moderate' },
  4: { Icon: KeyboardDoubleArrowDownIcon, color: '#2B9AF3', label: 'Low' },
  5: { Icon: PendingActionsOutlinedIcon, color: '#2B9AF3', label: 'Planning' },
};

const INCIDENT_STATE_MAP: Record<number, StatusData> = {
  1: { Icon: PendingOutlinedIcon, color: '#6A6E73', label: 'New' },
  2: { Icon: InProgressIcon, color: '#6A6E73', label: 'In Progress' },
  3: { Icon: PauseCircleOutlineIcon, color: '#F0AB00', label: 'On Hold' },
  6: { Icon: CheckCircleOutlineIcon, color: '#3E8635', label: 'Resolved' },
  7: { Icon: CheckCircleOutlineIcon, color: '#3E8635', label: 'Closed' },
  8: { Icon: DoDisturbAltIcon, color: '#6A6E73', label: 'Cancelled' },
};

const renderStatusLabel = (data?: StatusData) => {
  if (!data) return '';

  const { Icon, color, label, transform } = data;
  return (
    <Typography variant="body2" style={typographyStyleBase}>
      <Icon
        fontSize="small"
        style={{
          color,
          marginRight: iconStyleBase.marginRight,
          ...(transform ? { transform } : {}),
        }}
      />
      {label}
    </Typography>
  );
};

export const getPriorityValue = (priority: number) =>
  renderStatusLabel(PRIORITY_MAP[priority]);
export const getIncidentStateValue = (state: number) =>
  renderStatusLabel(INCIDENT_STATE_MAP[state]);
