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

import { IncidentTableFieldEnum } from '../types';

export function buildIncidentQueryParams({
  entityId,
  limit,
  offset,
  order,
  orderBy,
  search,
  priority,
  state,
}: {
  entityId: string;
  limit: number;
  offset: number;
  order: 'asc' | 'desc';
  orderBy: IncidentTableFieldEnum;
  search?: string;
  priority?: string[];
  state?: string[];
}) {
  const params: Record<string, string> = {
    entityId,
    order,
    orderBy,
    limit: String(limit),
    offset: String(offset),
    ...(search ? { search } : {}),
  };

  if (priority?.length) {
    params.priority = `IN${priority.join(',')}`;
  }

  if (state?.length) {
    params.state = `IN${state.join(',')}`;
  }

  return new URLSearchParams(params);
}
