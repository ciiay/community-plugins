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
import {
  InputError,
  NotFoundError,
  AuthenticationError,
} from '@backstage/errors';
import {
  AuthService,
  HttpAuthService,
  LoggerService,
  UserInfoService,
} from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import { ServiceNowSingleConfig } from './config/config';
import { DefaultServiceNowClient } from './service-now-rest/client';
import type { CatalogApi } from '@backstage/catalog-client';
import { Entity } from '@backstage/catalog-model';

export interface RouterOptions {
  logger: LoggerService;
  servicenowConfig: ServiceNowSingleConfig;
  userInfoService: UserInfoService;
  httpAuth: HttpAuthService;
  auth: AuthService;
  catalogApi: CatalogApi;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const {
    logger,
    servicenowConfig,
    userInfoService,
    httpAuth,
    auth,
    catalogApi,
  } = options;

  logger.info(
    `Creating router for ServiceNow with instance URL: ${servicenowConfig.instanceUrl}`,
  );

  const client = new DefaultServiceNowClient(
    servicenowConfig,
    logger.child({ service: 'servicenow-client' }),
  );
  const router = Router();
  router.use(express.json());

  router.get('/health', (_, response) => {
    logger.info('PONG!');
    response.json({ status: 'ok' });
  });

  router.get('/incidents', async (req, res) => {
    const {
      state,
      priority,
      shortDescription,
      limit: limitStr,
      offset: offsetStr,
    } = req.query;

    const userCredentials = await httpAuth.credentials(req, {
      allow: ['user'],
    });

    const userInfo = await userInfoService.getUserInfo(userCredentials);
    if (!userInfo.userEntityRef) {
      throw new InputError('User entity reference not found in user info');
    }

    const ownCreds = await auth.getOwnServiceCredentials();
    const pluginTokenResponse = await auth.getPluginRequestToken({
      onBehalfOf: ownCreds,
      targetPluginId: 'catalog',
    });

    if (!pluginTokenResponse.token) {
      throw new AuthenticationError('Plugin token is missing or invalid');
    }
    const catalogToken = pluginTokenResponse.token;

    const userEntity: Entity | undefined = await catalogApi.getEntityByRef(
      userInfo.userEntityRef,
      { token: catalogToken },
    );

    if (!userEntity) {
      throw new NotFoundError(
        `User entity not found for ref: ${userInfo.userEntityRef}`,
      );
    }

    const userEmail = (userEntity.spec?.profile as any)?.email;
    if (!userEmail) {
      throw new NotFoundError(
        `Email not found for user ${userInfo.userEntityRef}`,
      );
    }

    const fetchOptions: {
      state?: string;
      priority?: string;
      shortDescription?: string;
      limit?: number;
      offset?: number;
      userEmail: string;
    } = {
      userEmail: userEmail,
    };

    if (state) fetchOptions.state = String(state);
    if (priority) fetchOptions.priority = String(priority);
    if (shortDescription)
      fetchOptions.shortDescription = String(shortDescription);

    try {
      if (limitStr !== undefined) {
        const limit = parseInt(String(limitStr), 10);
        if (isNaN(limit) || limit < 0) {
          throw new InputError(
            `Invalid limit parameter: ${limitStr}. Must be a non-negative number.`,
          );
        }
        fetchOptions.limit = limit;
      }

      if (offsetStr !== undefined) {
        const offset = parseInt(String(offsetStr), 10);
        if (isNaN(offset) || offset < 0) {
          throw new InputError(
            `Invalid offset parameter: ${offsetStr}. Must be a non-negative number.`,
          );
        }
        fetchOptions.offset = offset;
      }

      const incidents = await client.fetchIncidents(fetchOptions);
      res.json(incidents);
    } catch (error) {
      if (error instanceof InputError) {
        throw error;
      }

      // Log the full error and throw a generic one
      logger.error('Failed to fetch incidents from ServiceNow', error);
      throw new Error('Failed to fetch incidents from ServiceNow');
    }
  });

  return router;
}
