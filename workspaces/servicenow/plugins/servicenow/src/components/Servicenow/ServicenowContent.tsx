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

import React, {
  useEffect,
  useState,
  useCallback,
  MouseEvent,
  ChangeEvent,
} from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { useSearchParams } from 'react-router-dom';

import { CatalogFilterLayout } from '@backstage/plugin-catalog-react';
import { Table } from '@backstage/core-components';
import Box from '@mui/material/Box';
import TablePagination from '@mui/material/TablePagination';

import { IncidentsFilter } from './IncidentsFilter';
import { IncidentsListColumns } from './IncidentsListColumns';
import { IncidentsTableBody } from './IncidentsTableBody';
import { IncidentsTableHeader } from './IncidentsTableHeader';
import { IncidentTableFieldEnum, SortingOrderEnum } from '../../types';
import { buildIncidentQueryParams } from '../../utils/queryParamsUtils';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useQueryState } from '../../hooks/useQueryState';
import { serviceNowApiRef } from '../../api/ServiceNowBackendClient';

export const ServicenowContent = () => {
  const serviceNowApi = useApi(serviceNowApiRef);

  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState(() => searchParams.get('search') ?? '');
  const debouncedSearch = useDebouncedValue(input, 300);

  const [order, setOrder] = useQueryState<SortingOrderEnum>(
    'order',
    SortingOrderEnum.Asc,
  );
  const [orderBy, setOrderBy] = useState<IncidentTableFieldEnum>(
    () =>
      (searchParams.get('orderBy') as IncidentTableFieldEnum) ??
      IncidentTableFieldEnum.Number,
  );

  const [rowsPerPage, setRowsPerPage] = useQueryState<number>('limit', 5);
  const [offset, setOffset] = useQueryState<number>('offset', 0);

  const pageNumber = Math.floor(offset / rowsPerPage);

  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    async function fetchIncidents() {
      setLoading(true);
      setError(null);
      try {
        const queryParams = buildIncidentQueryParams({
          entityId: 'my-service-id',
          limit: rowsPerPage,
          offset,
          order,
          orderBy,
          search: debouncedSearch,
        });

        const data =
          await serviceNowApi.getIncidents(/* queryParams.toString()*/);
        setIncidents(data);
      } catch (e) {
        setError((e as Error).message);
        setIncidents([]);
      } finally {
        setLoading(false);
      }
    }

    fetchIncidents();
  }, [rowsPerPage, offset, order, orderBy, debouncedSearch, serviceNowApi]);

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

  const handleRowsPerPageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newLimit = parseInt(event.target.value, 10);
    setRowsPerPage(newLimit);
    setOffset(0);
  };

  const handlePageChange = (_event: unknown, page: number) => {
    setOffset(page * rowsPerPage);
  };

  const handleRequestSort = (
    _event: MouseEvent<unknown>,
    property: IncidentTableFieldEnum,
  ) => {
    const isAsc = orderBy === property && order === SortingOrderEnum.Asc;
    setOrder(isAsc ? SortingOrderEnum.Desc : SortingOrderEnum.Asc);
    setOrderBy(property);
  };

  const handleSearch = (str: string) => {
    setInput(str);
    updateQueryParams('offset', 0);
  };

  if (loading) {
    return <Box sx={{ padding: 2 }}>Loading incidents...</Box>;
  }

  if (error) {
    return (
      <Box sx={{ padding: 2, color: 'error.main' }}>
        Error loading incidents: {error}
      </Box>
    );
  }

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
          <IncidentsFilter />
        </CatalogFilterLayout.Filters>
        <CatalogFilterLayout.Content>
          <Table
            data={incidents}
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
              Body: () => <IncidentsTableBody rows={incidents} />,
              Pagination: () => (
                <TablePagination
                  rowsPerPageOptions={[5, 10, 20, 50, 100].map(n => ({
                    value: n,
                    label: `${n} rows`,
                  }))}
                  component="div"
                  sx={{ mr: 1 }}
                  count={incidents.length ?? 0}
                  rowsPerPage={rowsPerPage}
                  page={pageNumber}
                  onPageChange={handlePageChange}
                  onRowsPerPageChange={handleRowsPerPageChange}
                  labelRowsPerPage={null}
                  showFirstButton
                  showLastButton
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
