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

export interface ServiceNowClient {
  fetchIncidents(options: {
    assignedTo?: string;
    state?: string;
    priority?: string;
    shortDescription?: string;
    limit?: number;
    offset?: number;
    userEmail: string;
  }): Promise<any>;
}

export class DefaultServiceNowClient implements ServiceNowClient {
  private readonly oauthClient: ClientCredentials | ResourceOwnerPassword;
  private readonly instanceUrl: string;
  private readonly config: ServiceNowSingleConfig;
  private readonly logger: LoggerService;

  constructor(config: ServiceNowSingleConfig, logger: LoggerService) {
    this.config = config;
    this.logger = logger;
    this.instanceUrl = config.instanceUrl.replace(/\/$/, '');

    if (!config.oauth) {
      logger.error('ServiceNow OAuth configuration is missing.');
      throw new Error('ServiceNow OAuth configuration is missing.');
    }

    const determinedTokenUrl =
      config.oauth.tokenUrl ?? `${this.instanceUrl}/oauth_token.do`;

    let tokenHost: string;
    let tokenPath: string;
    try {
      const parsedTokenUrl = new URL(determinedTokenUrl);
      tokenHost = parsedTokenUrl.origin;
      tokenPath = parsedTokenUrl.pathname;
    } catch (e: any) {
      logger.error(
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
        logger.error(
          "Username and/or password missing for 'password' grant type in ServiceNow OAuth config.",
        );
        throw new Error(
          "Username and/or password missing for 'password' grant type.",
        );
      }
      this.oauthClient = new ResourceOwnerPassword(oauthModuleOptions);
    } else {
      const grantType = (config.oauth as any).grantType;
      logger.error(`Unsupported OAuth grantType: ${grantType}`);
      throw new Error(`Unsupported OAuth grantType: ${grantType}`);
    }
  }

  private async getToken(): Promise<string> {
    if (!this.config.oauth) {
      this.logger.error('OAuth configuration is missing in getToken call.');
      throw new Error('OAuth configuration is missing for token retrieval.');
    }
    let accessToken: AccessToken;
    try {
      if (this.config.oauth.grantType === 'client_credentials') {
        accessToken = await (this.oauthClient as ClientCredentials).getToken(
          {},
        );
      } else if (this.config.oauth.grantType === 'password') {
        if (!this.config.oauth.username || !this.config.oauth.password) {
          this.logger.error(
            "Cannot get token for 'password' grant: username or password missing.",
          );
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
        const grantType = (this.config.oauth as any).grantType;
        this.logger.error(
          `getToken called with unsupported grantType: ${grantType}`,
        );
        throw new Error(`Unsupported grantType in getToken: ${grantType}`);
      }

      const tokenData = accessToken.token;
      // Ensure tokenData and access_token are valid
      if (
        !tokenData ||
        typeof tokenData.access_token !== 'string' ||
        !tokenData.access_token
      ) {
        this.logger.error(
          'Failed to obtain a valid access_token string from ServiceNow token object.',
        );
        throw new Error(
          'Failed to obtain access_token string (token data is invalid or missing).',
        );
      }
      return tokenData.access_token;
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

  async fetchIncidents(options: {
    state?: string;
    priority?: string;
    shortDescription?: string;
    limit?: number;
    offset?: number;
    userEmail: string;
  }): Promise<any[]> {
    const token = await this.getToken();
    const params = new URLSearchParams();
    const queryParts: string[] = [];

    if (options.userEmail) {
      const id = await this.getUserSysIdByEmail(options.userEmail);
      queryParts.push(`caller_id=${id}^ORopened_by=${id}^ORassigned_to=${id}`);
    }

    if (options.state)
      queryParts.push(`state=${encodeURIComponent(options.state)}`);
    if (options.priority)
      queryParts.push(`priority=${encodeURIComponent(options.priority)}`);
    if (options.shortDescription)
      queryParts.push(
        `short_descriptionCONTAINS${encodeURIComponent(
          options.shortDescription,
        )}`,
      );

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
          Authorization: `Bearer ${token}`,
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
    const token = await this.getToken();
    const url = `${
      this.instanceUrl
    }/api/now/table/sys_user?sysparm_query=email=${encodeURIComponent(
      email,
    )}&sysparm_fields=sys_id`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    const users = response.data?.result;
    if (users && users.length > 0) return users[0].sys_id;
    return null;
  }
}
