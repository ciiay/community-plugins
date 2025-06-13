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
import { InputError } from '@backstage/errors';
import { LoggerService } from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import { ServiceNowSingleConfig } from './config/config';
import { DefaultServiceNowClient } from './service-now-rest/client';

export interface RouterOptions {
  logger: LoggerService;
  servicenowConfig: ServiceNowSingleConfig;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, servicenowConfig } = options;

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
      assignedTo,
      state,
      priority,
      shortDescription,
      limit: limitStr,
      offset: offsetStr,
    } = req.query;

    const fetchOptions: {
      assignedTo?: string;
      state?: string;
      priority?: string;
      shortDescription?: string;
      limit?: number;
      offset?: number;
    } = {};

    if (assignedTo) fetchOptions.assignedTo = String(assignedTo);
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
    } catch (error: any) {
      logger.error(`Failed to fetch incidents: ${error.message}`, {
        stack: error.stack,
        status: error.status,
        name: error.name,
      });
      throw error;
    }
  });

  return router;
}
