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
import { IncidentsData } from '@backstage-community/plugin-servicenow-common';
import {
  createApiRef,
  DiscoveryApi,
  FetchApi,
  IdentityApi,
} from '@backstage/core-plugin-api';

export interface ServiceNowBackendAPI {
  getIncidents(queryParams: URLSearchParams): Promise<IncidentsData[]>;
}

export const serviceNowApiRef = createApiRef<ServiceNowBackendAPI>({
  id: 'plugin.servicenow.service',
});

export class ServiceNowBackendClient implements ServiceNowBackendAPI {
  constructor(
    private readonly discoveryApi: DiscoveryApi,
    private readonly fetchApi: FetchApi,
    private readonly identityApi: IdentityApi,
  ) {}

  private async fetchFromServiceNow<T>(
    path: string,
    queryParams?: URLSearchParams,
  ): Promise<T> {
    const proxyBase = await this.discoveryApi.getBaseUrl('servicenow');
    const url = `${proxyBase}${path}${queryParams ? `?${queryParams}` : ''}`;

    const { token } = await this.identityApi.getCredentials();
    const headers = {
      Authorization: `Bearer ${token}`,
    };
    const response = await this.fetchApi.fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`ServiceNow API request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async getIncidents(queryParams: URLSearchParams): Promise<IncidentsData[]> {
    return this.fetchFromServiceNow<IncidentsData[]>('/incidents', queryParams);
  }
}
