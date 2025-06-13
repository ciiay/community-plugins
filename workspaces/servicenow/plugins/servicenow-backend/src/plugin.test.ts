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
import { ConfigReader } from '@backstage/config';
import {
  coreServices,
  createServiceFactory,
} from '@backstage/backend-plugin-api';
import { startTestBackend, mockServices } from '@backstage/backend-test-utils';
import request from 'supertest';

const mockFetchIncidents = jest.fn();

const validServicenowConfig = new ConfigReader({
  servicenow: {
    instanceUrl: 'https://mock.service-now.com',
    oauth: {
      grantType: 'client_credentials',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    },
  },
});

describe('servicenowPlugin', () => {
  let MockedDefaultServiceNowClientConstructor: jest.Mock;

  beforeEach(() => {
    jest.resetModules();

    mockFetchIncidents.mockReset();

    MockedDefaultServiceNowClientConstructor = jest
      .fn()
      .mockImplementation(() => {
        return {
          fetchIncidents: mockFetchIncidents,
        };
      });

    jest.doMock('./service-now-rest/client', () => {
      return {
        DefaultServiceNowClient: MockedDefaultServiceNowClientConstructor,
      };
    });
  });

  it('should start and expose health check endpoint when configured', async () => {
    const { servicenowPlugin } = require('./plugin');

    const { server } = await startTestBackend({
      features: [
        servicenowPlugin,
        createServiceFactory({
          service: coreServices.rootConfig,
          deps: {},
          factory: () => validServicenowConfig,
        }),
        mockServices.logger.factory(),
      ],
    });

    const agent = request.agent(server);
    const response = await agent.get('/api/servicenow/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    await server.stop();
  });

  it('should respond to /incidents if configured', async () => {
    const { servicenowPlugin } = require('./plugin');
    const mockIncidentsData = [
      { id: 'INC001', short_description: 'Test incident' },
    ];
    mockFetchIncidents.mockResolvedValueOnce(mockIncidentsData);

    const { server } = await startTestBackend({
      features: [
        servicenowPlugin,
        createServiceFactory({
          service: coreServices.rootConfig,
          deps: {},
          factory: () => validServicenowConfig,
        }),
        mockServices.logger.factory(),
      ],
    });
    const agent = request.agent(server);
    const response = await agent.get('/api/servicenow/incidents?limit=1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockIncidentsData);
    expect(MockedDefaultServiceNowClientConstructor).toHaveBeenCalledTimes(1);
    expect(mockFetchIncidents).toHaveBeenCalledTimes(1);
    expect(mockFetchIncidents).toHaveBeenCalledWith({
      limit: 1,
      offset: undefined,
      assignedTo: undefined,
      state: undefined,
      priority: undefined,
      shortDescription: undefined,
    });
    await server.stop();
  });

  it('should not initialize main routes if servicenow config is missing', async () => {
    const { servicenowPlugin } = require('./plugin');
    const logger = mockServices.logger.mock();

    const { server } = await startTestBackend({
      features: [
        servicenowPlugin,
        createServiceFactory({
          service: coreServices.logger,
          deps: {},
          factory: () => logger,
        }),
        createServiceFactory({
          service: coreServices.rootConfig,
          deps: {},
          factory: () => new ConfigReader({}),
        }),
      ],
    });

    expect(logger.error).toHaveBeenCalledWith(
      'ServiceNow plugin configuration is missing. The plugin will not be initialized.',
    );

    const agent = request.agent(server);
    const incidentsResponse = await agent
      .get('/api/servicenow/incidents')
      .catch(e => e.response);
    expect(incidentsResponse.status).toBe(404);

    const healthResponse = await agent
      .get('/api/servicenow/health')
      .catch(e => e.response);
    expect(healthResponse.status).toBe(404);
    await server.stop();
  });

  it('should handle errors from serviceNowClient.fetchIncidents', async () => {
    const { servicenowPlugin } = require('./plugin');
    mockFetchIncidents.mockRejectedValueOnce(new Error('ServiceNow API Error'));

    const { server } = await startTestBackend({
      features: [
        servicenowPlugin,
        createServiceFactory({
          service: coreServices.rootConfig,
          deps: {},
          factory: () => validServicenowConfig,
        }),
        mockServices.logger.factory(),
      ],
    });

    const agent = request.agent(server);
    const response = await agent.get('/api/servicenow/incidents');

    expect(response.status).toBe(500);
    expect(response.body.error.message).toBe('ServiceNow API Error');
    expect(MockedDefaultServiceNowClientConstructor).toHaveBeenCalledTimes(1);
    expect(mockFetchIncidents).toHaveBeenCalledTimes(1);
    await server.stop();
  });
});
