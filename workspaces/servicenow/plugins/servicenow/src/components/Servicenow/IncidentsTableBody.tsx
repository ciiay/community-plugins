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
import { default as React } from 'react';
import Box from '@mui/material/Box';
import TableBody from '@mui/material/TableBody';

import { IncidentsData } from '../../types';
import { IncidentsListColumns } from './IncidentsListColumns';
import { IncidentsTableRow } from './IncidentsTableRow';

export const IncidentsTableBody = ({
  // loading,
  rows,
}: // emptyRows,
// error,
{
  // error: { [key: string]: string };
  // loading: boolean;
  // emptyRows: number;
  rows: IncidentsData[];
}) => {
  // if (loading) {
  //   return (
  //     <tbody>
  //       <tr>
  //         <td colSpan={IncidentsListColumns?.length}>
  //           <Box
  //             data-testid="incidents-loading"
  //             sx={{
  //               p: 2,
  //               display: 'flex',
  //               justifyContent: 'center',
  //             }}
  //           >
  //             <CircularProgress />
  //           </Box>
  //         </td>
  //       </tr>
  //     </tbody>
  //   );
  // }
  // if (Object.keys(error || {}).length > 0) {
  //   return (
  //     <tbody>
  //       <tr>
  //         <td colSpan={IncidentsListColumns?.length}>
  //           <div data-testid="incidents-error">
  //             <Alert severity="error">{`${error.name}. ${error.message}`}</Alert>
  //           </div>
  //         </td>
  //       </tr>
  //     </tbody>
  //   );
  // }

  if (rows?.length > 0) {
    return (
      <TableBody data-testid="incidents">
        {rows.map(row => {
          return <IncidentsTableRow key={row.number} data={row} />;
        })}
        {/* {emptyRows > 0 && (
          <TableRow
            style={{
              height: 55 * emptyRows,
            }}
          >
            <TableCell />
          </TableRow>
        )} */}
      </TableBody>
    );
  }
  return (
    <tbody>
      <tr>
        <td colSpan={IncidentsListColumns?.length}>
          <Box
            data-testid="no-incidents-found"
            sx={{
              p: 2,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            No records found
          </Box>
        </td>
      </tr>
    </tbody>
  );
};
