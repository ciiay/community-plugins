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
import { TableColumn } from '@backstage/core-components';

import { IncidentsData } from '../../types';

export const IncidentsListColumns: TableColumn<IncidentsData>[] = [
  {
    id: 'incidentNumber',
    title: 'Request ID',
    field: 'number',
    type: 'string',
  },
  {
    id: 'description',
    title: 'Description',
    field: 'shortDescription',
    type: 'string',
  },
  {
    id: 'created',
    title: 'Created',
    field: 'sysCreatedOn',
    type: 'string',
  },
  {
    id: 'priority',
    title: 'Priority',
    field: 'priority',
    type: 'numeric',
  },
  {
    id: 'state',
    title: 'State',
    field: 'incidentState',
    type: 'datetime',
  },
  {
    id: 'actions',
    title: 'Actions',
    field: 'actions',
    sorting: false,
    type: 'string',
  },
];
