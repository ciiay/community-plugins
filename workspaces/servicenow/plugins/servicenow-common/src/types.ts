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

/**
 * Incident common type - represents a ServiceNow incident, but with limited set of the fields.
 * So, it is not meant to be a complete representation of a ServiceNow incident.
 * This is used to ensure that the incident data is consistent across different parts of the plugin.
 * It should be used in the frontend to display incident data in a consistent way.
 * It is used in the backend to fetch incident data from ServiceNow.
 * @public
 */
export type IncidentPick = {
  sys_id: string;
  number: string;
  short_description: string;
  description: string;
  sys_created_on: string;
  priority: number;
  incident_state: number;
};

export const IncidentFieldEnum = {
  Number: 'number',
  ShortDescription: 'short_description',
  Description: 'description',
  Created: 'sys_created_on',
  Priority: 'priority',
  IncidentState: 'incident_state',
} as const;

export const SortingOrderEnum = {
  Asc: 'asc',
  Desc: 'desc',
} as const;
export type SortingOrderEnumType = typeof SortingOrderEnum;

export type Order = SortingOrderEnumType[keyof SortingOrderEnumType];

export const ServiceAnnotationFieldName = 'u_backstage_entity_id';
