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

export function buildIncidentQueryParams({
  entityId,
  limit,
  offset,
  order,
  orderBy,
  search,
}: {
  entityId: string;
  limit: number;
  offset: number;
  order: 'asc' | 'desc';
  orderBy: string;
  search?: string;
}) {
  return new URLSearchParams({
    sysparm_query: `u_backstage_entity_id=${entityId}`,
    ...(order === 'asc'
      ? { sysparm_order_by: orderBy }
      : { sysparm_order_byDESC: orderBy }),
    sysparm_limit: String(limit),
    sysparm_offset: String(offset),
    sysparm_fields:
      'number,short_description,description,sys_created_on,priority,incident_state',
    ...(search ? { search } : {}),
  });
}
