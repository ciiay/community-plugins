/*
 * Copyright 2025 The Backstage Authors
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

import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import IconButton from '@mui/material/IconButton';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import { makeStyles } from '@mui/styles';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { convertDateFormat } from '../../utils/stringUtils';
import { IncidentsData } from '../../types';
import {
  getIncidentStateValue,
  getPriorityValue,
} from '../../utils/incidentUtils';

const useStyles = makeStyles(() => ({
  tableCellStyle: {
    lineHeight: '1.5rem',
    fontSize: '0.875rem',
  },
}));

const getIncidentUrl = (incidentNumber: string) => {
  // eslint-disable-next-line no-console
  console.log(incidentNumber);
  return `https://dev312848.service-now.com/nav_to.do?uri=incident.do?sys_id=1c741bd70b2322007518478d83673af3`;
};

// uncomment this when backend plugin is implemented
// const getIncidentUrl = async (incidentNumber: string): Promise<string | null> => {
//   try {
//     // implement this in the ServiceNow backend plugin
//     const response = await fetch(`/api/servicenow/incident-url?number=${incidentNumber}`);
//     const data = await response.json();
//     return data?.url ?? null;
//   } catch (err) {
//     console.error('Failed to fetch incident URL:', err);
//     return null;
//   }
// };

export const IncidentsTableRow = ({ data }: { data: IncidentsData }) => {
  const classes = useStyles();

  return (
    <TableRow
      hover
      sx={{
        fontSize: '0.875rem',
        '&:last-child td, &:last-child th': { border: 0 },
        borderBottom: '1px solid #e0e0e0',
      }}
    >
      <TableCell component="th" scope="row" className={classes.tableCellStyle}>
        {data.number}
      </TableCell>
      <TableCell align="left" className={classes.tableCellStyle}>
        <Tooltip title={data?.description} arrow placement="top">
          <Typography
            variant="body1"
            style={{
              maxWidth: 208,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {data?.shortDescription}
          </Typography>
        </Tooltip>
      </TableCell>
      <TableCell align="left" className={classes.tableCellStyle}>
        {convertDateFormat(data?.sysCreatedOn)}
      </TableCell>
      <TableCell align="left" className={classes.tableCellStyle}>
        {getPriorityValue(data?.priority)}
      </TableCell>

      <TableCell align="left" className={classes.tableCellStyle}>
        {getIncidentStateValue(data?.incidentState)}
      </TableCell>
      <TableCell align="left" className={classes.tableCellStyle}>
        <IconButton
          onClick={() => window.open(getIncidentUrl(data?.number), '_blank')}
        >
          <OpenInNewIcon fontSize="small" style={{ color: 'inherit' }} />
        </IconButton>
      </TableCell>
    </TableRow>
  );
};
