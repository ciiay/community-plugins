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
import { mockErrorHandler, mockServices } from '@backstage/backend-test-utils';
import express from 'express';
import request from 'supertest';

import { createRouter } from './router';
import { ServiceNowSingleConfig } from './config/config';

// Mock the DefaultServiceNowClient before it's imported by ./router
const mockFetchIncidents = jest.fn();
jest.mock('./service-now-rest/client', () => ({
  DefaultServiceNowClient: jest.fn().mockImplementation(() => ({
    fetchIncidents: mockFetchIncidents,
  })),
}));

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

  beforeEach(async () => {
    jest.clearAllMocks();

    const router = await createRouter({
      logger: mockServices.logger.mock(),
      servicenowConfig: mockServiceNowConfig,
    });
    app = express();
    app.use(router);
    app.use(mockErrorHandler());
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

      expect(response.body.error.message).toBe(
        'Invalid limit parameter: abc. Must be a non-negative number.',
      );
    });

    it('should return 400 for invalid offset parameter', async () => {
      const response = await request(app).get('/incidents?offset=xyz');
      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe(
        'Invalid offset parameter: xyz. Must be a non-negative number.',
      );
    });

    it('should handle errors from serviceNowClient.fetchIncidents (non-InputError)', async () => {
      mockFetchIncidents.mockRejectedValue(new Error('ServiceNow unavailable'));
      const response = await request(app).get('/incidents');
      expect(response.status).toBe(500);

      expect(response.body.error).toEqual({
        name: 'Error',
        message: 'ServiceNow unavailable',
      });
    });

    it('should fetch incidents with limit and offset successfully', async () => {
      const mockIncidentsData = [
        { id: 'INC001', description: 'Incident 1' },
        { id: 'INC002', description: 'Incident 2' },
      ];
      mockFetchIncidents.mockResolvedValueOnce(mockIncidentsData);

      const response = await request(app).get('/incidents?limit=5&offset=0');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockIncidentsData);
      expect(mockFetchIncidents).toHaveBeenCalledWith({
        assignedTo: undefined,
        state: undefined,
        priority: undefined,
        shortDescription: undefined,
        limit: 5,
        offset: 0,
      });
    });
  });
});
