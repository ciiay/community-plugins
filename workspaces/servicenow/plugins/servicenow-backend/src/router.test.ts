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
  mockCredentials,
  mockErrorHandler,
  mockServices,
} from '@backstage/backend-test-utils';
import express from 'express';
import request from 'supertest';

import { createRouter } from './router';
import { TodoListService } from './services/TodoListService/types';
import { ServiceNowSingleConfig } from './config/config';

// Mock the DefaultServiceNowClient before it's imported by ./router
const mockFetchIncidents = jest.fn();
jest.mock('./service-now-rest/client', () => ({
  DefaultServiceNowClient: jest.fn().mockImplementation(() => ({
    fetchIncidents: mockFetchIncidents,
  })),
}));

const mockTodoItem = {
  title: 'Do the thing',
  id: '123',
  createdBy: mockCredentials.user().principal.userEntityRef,
  createdAt: new Date().toISOString(),
};

const mockServiceNowConfig: ServiceNowSingleConfig = {
  instanceUrl: 'https://dev12345.service-now.com',
  oauth: {
    grantType: 'client_credentials',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
  },
};

describe('createRouter', () => {
  let app: express.Express;
  let todoListService: jest.Mocked<TodoListService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    todoListService = {
      createTodo: jest.fn(),
      listTodos: jest.fn(),
      getTodo: jest.fn(),
    };
    const router = await createRouter({
      logger: mockServices.logger.mock(),
      httpAuth: mockServices.httpAuth(),
      todoListService,
      servicenowConfig: mockServiceNowConfig,
    });
    app = express();
    app.use(router);
    app.use(mockErrorHandler());
  });

  it('should create a TODO', async () => {
    todoListService.createTodo.mockResolvedValue(mockTodoItem);

    const response = await request(app).post('/todos').send({
      title: 'Do the thing',
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(mockTodoItem);
  });

  it('should not allow unauthenticated requests to create a TODO', async () => {
    todoListService.createTodo.mockResolvedValue(mockTodoItem);
    const response = await request(app)
      .post('/todos')
      .set('Authorization', mockCredentials.none.header())
      .send({
        title: 'Do the thing',
      });

    expect(response.status).toBe(401);
  });

  describe('/incidents route', () => {
    it('should respond to GET request and call fetchIncidents', async () => {
      const mockIncidentsData = [
        { id: 'INC123', description: 'Test Incident' },
      ];
      mockFetchIncidents.mockResolvedValue(mockIncidentsData);

      const response = await request(app).get(
        '/incidents?limit=10&offset=0&assignedTo=user1&state=Open&priority=1&shortDescription=network',
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockIncidentsData);
      expect(mockFetchIncidents).toHaveBeenCalledWith({
        limit: 10,
        offset: 0,
        assignedTo: 'user1',
        state: 'Open',
        priority: '1',
        shortDescription: 'network',
      });
    });

    it('should return 400 for invalid limit parameter', async () => {
      const response = await request(app).get('/incidents?limit=abc');
      expect(response.status).toBe(400);
      // mockErrorHandler formats InputError as { error: { name: 'InputError', message: '...' } }
      expect(response.body.error.message).toContain(
        'Invalid limit parameter: must be a non-negative number.',
      );
    });

    it('should return 400 for invalid offset parameter', async () => {
      const response = await request(app).get('/incidents?offset=xyz');
      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain(
        'Invalid offset parameter: must be a non-negative number.',
      );
    });

    it('should handle errors from serviceNowClient.fetchIncidents (non-InputError)', async () => {
      mockFetchIncidents.mockRejectedValue(new Error('ServiceNow unavailable'));
      const response = await request(app).get('/incidents');
      expect(response.status).toBe(500);
      // The router's catch block formats this
      expect(response.body.error).toBe(
        'Failed to retrieve incidents from ServiceNow.',
      );
      expect(response.body.message).toBe('ServiceNow unavailable');
    });
  });
});
