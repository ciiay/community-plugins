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
import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';
import { InputError } from '@backstage/errors';
import { z } from 'zod';
import express from 'express';
import Router from 'express-promise-router';
import { TodoListService } from './services/TodoListService/types';
import { ServiceNowSingleConfig } from './config/config';
import { DefaultServiceNowClient } from './service-now-rest/client';

export interface RouterOptions {
  logger: LoggerService;
  httpAuth: HttpAuthService;
  todoListService: TodoListService;
  servicenowConfig: ServiceNowSingleConfig;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, httpAuth, todoListService, servicenowConfig } = options;

  const serviceNowClient = new DefaultServiceNowClient(
    servicenowConfig,
    logger.child({ service: 'servicenow-client' }),
  );

  const router = Router();
  router.use(express.json());

  logger.info(
    `Creating ServiceNow router with instance URL: ${servicenowConfig.instanceUrl}`,
  );

  const todoSchema = z.object({
    title: z.string(),
    entityRef: z.string().optional(),
  });

  router.post('/todos', async (req, res) => {
    const parsed = todoSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new InputError(parsed.error.toString());
    }

    const result = await todoListService.createTodo(parsed.data, {
      credentials: await httpAuth.credentials(req, { allow: ['user'] }),
    });

    res.status(201).json(result);
  });

  router.get('/todos', async (_req, res) => {
    res.json(await todoListService.listTodos());
  });

  router.get('/todos/:id', async (req, res) => {
    res.json(await todoListService.getTodo({ id: req.params.id }));
  });

  router.get(
    '/incidents',
    async (req: express.Request, res: express.Response) => {
      const { assignedTo, state, priority, shortDescription, limit, offset } =
        req.query as {
          assignedTo?: string;
          state?: string;
          priority?: string;
          shortDescription?: string;
          limit?: string;
          offset?: string;
        };

      const clientOptions: {
        assignedTo?: string;
        state?: string;
        priority?: string;
        shortDescription?: string;
        limit?: number;
        offset?: number;
      } = {
        assignedTo: assignedTo,
        state: state,
        priority: priority,
        shortDescription: shortDescription,
      };

      if (limit !== undefined) {
        const numLimit = parseInt(limit, 10);
        if (isNaN(numLimit) || numLimit < 0) {
          throw new InputError(
            'Invalid limit parameter: must be a non-negative number.',
          );
        }
        clientOptions.limit = numLimit;
      }

      if (offset !== undefined) {
        const numOffset = parseInt(offset, 10);
        if (isNaN(numOffset) || numOffset < 0) {
          throw new InputError(
            'Invalid offset parameter: must be a non-negative number.',
          );
        }
        clientOptions.offset = numOffset;
      }

      try {
        const incidents = await serviceNowClient.fetchIncidents(clientOptions);
        res.json(incidents);
      } catch (error: any) {
        logger.error(`Router failed to fetch incidents: ${error.message}`, {
          error: error.stack || error,
        });
        // Use a more specific status code if the error object has one (e.g., from ServiceNow client)
        const statusCode =
          error.status || (error.response && error.response.status) || 500;
        res.status(statusCode).json({
          error: 'Failed to retrieve incidents from ServiceNow.',
          message: error.message,
        });
      }
    },
  );

  return router;
}
