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
import { default as React, useState, useEffect, useCallback } from 'react';
import { Table } from '@backstage/core-components';
import { CatalogFilterLayout } from '@backstage/plugin-catalog-react';
import { mockIncidents } from '../../mocks/mockData';
import { IncidentsListColumns } from './IncidentsListColumns';
import Box from '@mui/material/Box';
import TablePagination from '@mui/material/TablePagination';
import { SortingOrderEnum } from '../../types';
import { IncidentsTableHeader } from './IncidentsTableHeader';
import { IncidentsTableBody } from './IncidentsTableBody';
import { useSearchParams } from 'react-router-dom';
import { useQueryState } from '../../hooks/useQueryState';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { buildIncidentQueryParams } from '../../utils/queryParamsUtils';

export const ServicenowContent = () => {
  const incidents = mockIncidents;
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState(() => searchParams.get('search') ?? '');
  const debouncedSearch = useDebouncedValue(input, 300);

  const [order, setOrder] = useQueryState<SortingOrderEnum>(
    'order',
    SortingOrderEnum.Asc,
  );
  const [orderBy, setOrderBy] = useState<string>(
    () => searchParams.get('orderBy') ?? 'incidentNumber',
  );

  const [rowsPerPage, setRowsPerPage] = useQueryState<number>('limit', 5);
  const [offset, setOffset] = useQueryState<number>('offset', 0);

  const pageNumber = Math.floor(offset / rowsPerPage);

  useEffect(() => {
    setSearchParams(
      prev => {
        const params = new URLSearchParams(prev);
        if (debouncedSearch) {
          params.set('search', debouncedSearch);
        } else {
          params.delete('search');
        }
        params.set('limit', String(rowsPerPage));
        params.set('offset', String(offset));
        params.set('order', order);
        params.set('orderBy', orderBy);
        return params;
      },
      { replace: true },
    );
  }, [debouncedSearch, rowsPerPage, offset, order, orderBy, setSearchParams]);

  const queryParams = buildIncidentQueryParams({
    entityId: 'my-service-id',
    limit: rowsPerPage,
    offset,
    order,
    orderBy,
    search: debouncedSearch,
  });

  // eslint-disable-next-line no-console
  console.log('Backend-ready query:', queryParams.toString());

  // Placeholder for future backend fetch
  // useEffect(() => {
  //   fetch(`https://<instance>.service-now.com/api/now/table/incident?${queryParams}`)
  //     .then(res => res.json())
  //     .then(json => setData(json.result))
  //     .catch(err => console.error(err));
  // }, [offset, rowsPerPage, debouncedSearch, orderBy]);

  const paginatedIncidents = incidents.slice(offset, offset + rowsPerPage);

  const updateQueryParams = useCallback(
    (key: string, value: string | number) => {
      setSearchParams(
        prev => {
          const params = new URLSearchParams(prev);
          params.set(key, value.toString());
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleRowsPerPageChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const newLimit = parseInt(event.target.value, 10);
    setRowsPerPage(newLimit);
    setOffset(0);
  };

  const handlePageChange = (_event: unknown, page: number) => {
    setOffset(page * rowsPerPage);
  };

  const handleRequestSort = (
    _event: React.MouseEvent<unknown>,
    property: string,
  ) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? SortingOrderEnum.Desc : SortingOrderEnum.Asc);
    setOrderBy(property);
  };

  const handleSearch = (str: string) => {
    setInput(str);
    updateQueryParams('offset', 0);
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
            data={paginatedIncidents}
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
              Body: () => <IncidentsTableBody rows={paginatedIncidents} />,
              Pagination: () => (
                <TablePagination
                  rowsPerPageOptions={[5, 10, 20, 50, 100].map(n => ({
                    value: n,
                    label: `${n} rows`,
                  }))}
                  component="div"
                  count={incidents.length ?? 0}
                  rowsPerPage={rowsPerPage}
                  page={pageNumber}
                  onPageChange={handlePageChange}
                  onRowsPerPageChange={handleRowsPerPageChange}
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
