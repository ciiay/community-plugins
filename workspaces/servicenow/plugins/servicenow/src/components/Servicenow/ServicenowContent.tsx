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
import { Table } from '@backstage/core-components';
import { CatalogFilterLayout } from '@backstage/plugin-catalog-react';
import { mockIncidents } from '../../mocks/mockData';
import { IncidentsListColumns } from './IncidentsListColumns';
import Box from '@mui/material/Box';
import TablePagination from '@mui/material/TablePagination';
import { SortingOrderEnum } from '../../types';
import { IncidentsTableHeader } from './IncidentsTableHeader';
import { IncidentsTableBody } from './IncidentsTableBody';

export const ServicenowContent = () => {
  const incidents = mockIncidents;
  const [order, setOrder] = React.useState<SortingOrderEnum>(
    SortingOrderEnum.Asc,
  );
  const [orderBy, setOrderBy] = React.useState<string>('incident-number');
  const [pageNumber, setPageNumber] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(5);
  // const [debouncedSearch, setDebouncedSearch] = React.useState('');

  // todo: implement data fetching with pagination, sorting
  const paginatedRows = incidents.slice(
    pageNumber * rowsPerPage,
    pageNumber * rowsPerPage + rowsPerPage,
  );

  const handleRequestSort = (
    _event: React.MouseEvent<unknown>,
    property: string,
  ) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? SortingOrderEnum.Desc : SortingOrderEnum.Asc);
    setOrderBy(property);
  };

  const handleSearch = (str: string) => {
    // setDebouncedSearch(str);
    // eslint-disable-next-line no-console
    console.log(str);
    setPageNumber(0);
  };
  return (
    <Box
      sx={{
        '& tr[class*="MuiTableRow-root"]': { backgroundColor: 'inherit' },
        '& tr.MuiTableRow-footer': { borderRadius: '4px' },
        '& [class*="Component-horizontalScrollContainer-"]': {
          margin: '0 24px',
        },
      }}
    >
      <CatalogFilterLayout>
        <CatalogFilterLayout.Filters>
          'filter placeholder'
        </CatalogFilterLayout.Filters>
        <CatalogFilterLayout.Content>
          <Table
            data={incidents ?? []}
            columns={IncidentsListColumns}
            onSearchChange={handleSearch}
            title={
              incidents.length === 0
                ? 'ServiceNow tickets'
                : `ServiceNow tickets (${incidents.length})`
            }
            localization={{
              toolbar: {
                searchPlaceholder: 'Search',
              },
            }}
            components={{
              Header: () => (
                <IncidentsTableHeader
                  order={order}
                  orderBy={orderBy}
                  onRequestSort={handleRequestSort}
                />
              ),
              Body: () => (
                <IncidentsTableBody
                  rows={paginatedRows ?? []}
                  // error={err}
                  // loading={loading}
                  // emptyRows={emptyRows}
                />
              ),
              Pagination: () => (
                <TablePagination
                  rowsPerPageOptions={[
                    { value: 5, label: '5 rows' },
                    { value: 10, label: '10 rows' },
                    { value: 20, label: '20 rows' },
                    { value: 50, label: '50 rows' },
                    { value: 100, label: '100 rows' },
                  ]}
                  component="div"
                  count={incidents.length ?? 0}
                  rowsPerPage={rowsPerPage}
                  page={pageNumber}
                  onPageChange={(_event, page: number) => {
                    setPageNumber(page);
                  }}
                  onRowsPerPageChange={event => {
                    setRowsPerPage(event.target.value as unknown as number);
                  }}
                  labelRowsPerPage={null}
                />
              ),
            }}
            emptyContent={
              <Box
                data-testid="no-incidents-found"
                sx={{
                  padding: 2,
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                No records found
              </Box>
            }
          />
        </CatalogFilterLayout.Content>
      </CatalogFilterLayout>
    </Box>
  );
};
