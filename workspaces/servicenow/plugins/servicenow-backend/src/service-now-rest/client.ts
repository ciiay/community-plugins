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

import { LoggerService } from '@backstage/backend-plugin-api';
import {
  ClientCredentials,
  ResourceOwnerPassword,
  ModuleOptions,
  AccessToken,
} from 'simple-oauth2';
import axios from 'axios';
import { ServiceNowSingleConfig } from '../config';
import { ServiceAnnotationFieldName } from '@backstage-community/plugin-servicenow-common';

// Types for ServiceNow incidents, but with cutted down fields
export type IncidentPick = {
  number: string;
  short_description: string;
  description: string;
  sys_created_on: string;
  priority: number;
  incident_state: number;
};

export type IncidentQueryParams = {
  entityId: string;
  userEmail: string;
  state?: string;
  priority?: string;
  search?: string;
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
  orderBy?: string;
};

export interface ServiceNowClient {
  fetchIncidents(options: IncidentQueryParams): Promise<IncidentPick[]>;
}

export class DefaultServiceNowClient implements ServiceNowClient {
  private readonly instanceUrl: string;
  private readonly config: ServiceNowSingleConfig;
  private readonly logger: LoggerService;
  private oauthClient?: ClientCredentials | ResourceOwnerPassword;

  constructor(config: ServiceNowSingleConfig, logger: LoggerService) {
    this.config = config;
    this.logger = logger;
    this.instanceUrl = config.instanceUrl.replace(/\/$/, '');

    if (!config.oauth && !config.basicAuth) {
      logger.error(
        'ServiceNow authentication configuration is missing. Please configure either OAuth or Basic Auth.',
      );
      throw new Error(
        'ServiceNow authentication configuration is missing. Please configure either OAuth or Basic Auth.',
      );
    }

    if (config.oauth) {
      this.setupOAuthClient(config);
    }

    if (config.basicAuth) {
      logger.warn(
        'Basic authentication is configured for ServiceNow. This is not recommended for production environments.',
      );
    }
  }

  private setupOAuthClient(config: ServiceNowSingleConfig) {
    if (!config.oauth) return;

    const determinedTokenUrl =
      config.oauth.tokenUrl ?? `${this.instanceUrl}/oauth_token.do`;

    let tokenHost: string;
    let tokenPath: string;
    try {
      const parsedTokenUrl = new URL(determinedTokenUrl);
      tokenHost = parsedTokenUrl.origin;
      tokenPath = parsedTokenUrl.pathname;
    } catch (e: any) {
      this.logger.error(
        `Invalid tokenUrl constructed or provided: ${determinedTokenUrl}. Error: ${e.message}`,
      );
      throw new Error(`Invalid tokenUrl: ${determinedTokenUrl}`);
    }

    const oauthModuleOptions: ModuleOptions = {
      client: {
        id: config.oauth.clientId,
        secret: config.oauth.clientSecret,
      },
      auth: {
        tokenHost: tokenHost,
        tokenPath: tokenPath,
      },
      options: {
        authorizationMethod: 'body',
      },
    };

    if (config.oauth.grantType === 'client_credentials') {
      this.oauthClient = new ClientCredentials(oauthModuleOptions);
    } else if (config.oauth.grantType === 'password') {
      if (!config.oauth.username || !config.oauth.password) {
        this.logger.error(
          "Username and/or password missing for 'password' grant type in ServiceNow OAuth config.",
        );
        throw new Error(
          "Username and/or password missing for 'password' grant type.",
        );
      }
      this.oauthClient = new ResourceOwnerPassword(oauthModuleOptions);
    } else {
      const grantType = (config.oauth as any).grantType;
      this.logger.error(`Unsupported OAuth grantType: ${grantType}`);
      throw new Error(`Unsupported OAuth grantType: ${grantType}`);
    }
  }

  private async getAuthHeaders(): Promise<{ Authorization: string }> {
    if (this.config.basicAuth) {
      const { username, password } = this.config.basicAuth;
      const encodedCredentials = Buffer.from(
        `${username}:${password}`,
      ).toString('base64');
      return { Authorization: `Basic ${encodedCredentials}` };
    }

    if (this.config.oauth && this.oauthClient) {
      let accessToken: AccessToken;
      try {
        if (this.config.oauth.grantType === 'client_credentials') {
          accessToken = await (this.oauthClient as ClientCredentials).getToken(
            {},
          );
        } else if (this.config.oauth.grantType === 'password') {
          if (!this.config.oauth.username || !this.config.oauth.password) {
            throw new Error(
              "Username or password missing for 'password' grant type during token acquisition.",
            );
          }
          accessToken = await (
            this.oauthClient as ResourceOwnerPassword
          ).getToken({
            username: this.config.oauth.username,
            password: this.config.oauth.password,
          });
        } else {
          throw new Error(
            `Unsupported grantType in getAuthHeaders: ${
              (this.config.oauth as any).grantType
            }`,
          );
        }

        const tokenData = accessToken.token;
        if (
          !tokenData ||
          typeof tokenData.access_token !== 'string' ||
          !tokenData.access_token
        ) {
          throw new Error(
            'Failed to obtain access_token string (token data is invalid or missing).',
          );
        }
        return { Authorization: `Bearer ${tokenData.access_token}` };
      } catch (error: any) {
        this.logger.error(`Error fetching ServiceNow token: ${error.message}`, {
          error: error.stack || error,
        });
        if (error.isAxiosError && error.response) {
          this.logger.error(
            `OAuth2 token error details: Status ${
              error.response.status
            }, Data: ${JSON.stringify(error.response.data)}`,
          );
        } else if (error.data && error.data.payload) {
          this.logger.error(
            `OAuth2 token error payload: ${JSON.stringify(error.data.payload)}`,
          );
        }
        throw new Error(`Failed to obtain access token: ${error.message}`);
      }
    }

    throw new Error('No authentication method configured.');
  }

  async fetchIncidents(options: IncidentQueryParams): Promise<IncidentPick[]> {
    const authHeaders = await this.getAuthHeaders();
    const params = new URLSearchParams();
    const queryParts: string[] = [];

    if (options.userEmail) {
      const id = await this.getUserSysIdByEmail(options.userEmail);
      queryParts.push(`caller_id=${id}^ORopened_by=${id}^ORassigned_to=${id}`);
    }

    if (options.state) queryParts.push(`state${options.state}`);
    if (options.priority) queryParts.push(`priority${options.priority}`);

    if (options.search) {
      const searchTerm = encodeURIComponent(options.search);
      queryParts.push(
        `short_descriptionLIKE${searchTerm}^ORdescriptionLIKE${searchTerm}`,
      );
    }

    if (options.entityId) {
      queryParts.push(`${ServiceAnnotationFieldName}=${options.entityId}`);
    }

    if (options.orderBy) {
      if (options.order === 'desc') {
        queryParts.push(`ORDERBYDESC${options.orderBy}`);
      } else {
        queryParts.push(`ORDERBY${options.orderBy}`);
      }
    }

    if (queryParts.length > 0) {
      params.append('sysparm_query', queryParts.join('^'));
    }

    if (options.limit !== undefined) {
      params.append('sysparm_limit', String(options.limit));
    }
    if (options.offset !== undefined) {
      params.append('sysparm_offset', String(options.offset));
    }
    params.append(
      'sysparm_fields',
      'number,short_description,description,sys_created_on,priority,incident_state',
    );

    const requestUrl = `${
      this.instanceUrl
    }/api/now/table/incident?${params.toString()}`;
    this.logger.info(
      `Fetching incidents from ServiceNow: ${this.instanceUrl}/api/now/table/incident?...`,
    );

    try {
      const response = await axios.get(requestUrl, {
        headers: {
          ...authHeaders,
          Accept: 'application/json',
        },
        timeout: 30000,
      });
      if (response.data && Array.isArray(response.data.result)) {
        this.logger.debug(
          `Successfully fetched ${response.data.result.length} incidents.`,
        );
        return response.data.result;
      }
      this.logger.warn('ServiceNow incidents response format unexpected.', {
        responseData: response.data,
      });
      return [];
    } catch (error: any) {
      this.logger.error(
        `Error fetching incidents from ServiceNow: ${error.message}`,
        { error: error.stack || error },
      );
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(
          `ServiceNow API Error Details: Status ${
            error.response.status
          }, Data: ${JSON.stringify(error.response.data)}`,
        );
      }
      throw new Error(
        `Failed to fetch incidents from ServiceNow: ${error.message}`,
      );
    }
  }

  private async getUserSysIdByEmail(email: string): Promise<string | null> {
    const authHeaders = await this.getAuthHeaders();
    const url = `${
      this.instanceUrl
    }/api/now/table/sys_user?sysparm_query=email=${encodeURIComponent(
      email,
    )}&sysparm_fields=sys_id`;
    const response = await axios.get(url, {
      headers: {
        ...authHeaders,
        Accept: 'application/json',
      },
    });
    const users = response.data?.result;
    if (users && users.length > 0) return users[0].sys_id;

    throw new Error(`User with email ${email} not found in ServiceNow.`);
  }
}
