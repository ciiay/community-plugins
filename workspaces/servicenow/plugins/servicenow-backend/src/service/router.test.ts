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
  AuthService,
  BackstageCredentials,
  BackstageUserPrincipal,
  HttpAuthService,
  UserInfoService,
} from '@backstage/backend-plugin-api';
import { UserEntity } from '@backstage/catalog-model';
import { NotFoundError, AuthenticationError } from '@backstage/errors';
import express from 'express';
import request from 'supertest';

import { createRouter } from './router';
import { mockErrorHandler, mockServices } from '@backstage/backend-test-utils';
import {
  CatalogServiceMock,
  catalogServiceMock,
} from '@backstage/plugin-catalog-node/testUtils';
import { ServiceNowSingleConfig } from '../config';

const mockFetchIncidents = jest.fn();
jest.mock('../service-now-rest/client', () => {
  return {
    DefaultServiceNowClient: jest.fn().mockImplementation(() => ({
      fetchIncidents: mockFetchIncidents,
    })),
  };
});

describe('createRouter', () => {
  let app: express.Express;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockHttpAuthService: jest.Mocked<HttpAuthService>;
  let mockUserInfoService: jest.Mocked<UserInfoService>;
  let mockCatalogApi: CatalogServiceMock;
  let mockServiceNowConfig: ServiceNowSingleConfig;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockAuthService = mockServices.auth.mock();
    mockHttpAuthService = mockServices.httpAuth.mock();
    mockUserInfoService = mockServices.userInfo.mock();
    mockCatalogApi = catalogServiceMock();

    mockServiceNowConfig = {
      instanceUrl: 'https://mock-instance.service-now.com',
      oauth: {
        grantType: 'client_credentials',
        clientId: 'mock-client-id',
        clientSecret: 'mock-client-secret',
        tokenUrl: 'https://mock-instance.service-now.com/oauth_token.do',
      },
    };

    const router = await createRouter({
      logger: mockServices.logger.mock(),
      servicenowConfig: mockServiceNowConfig,
      auth: mockAuthService,
      httpAuth: mockHttpAuthService,
      userInfoService: mockUserInfoService,
      catalogApi: mockCatalogApi,
    });

    app = express();
    app.use(router);
    app.use(mockErrorHandler());
  });

  describe('GET /incidents', () => {
    const mockBareToken = 'mock-secret-token';
    const mockAuthHeader = `Bearer ${mockBareToken}`;
    const mockUserEntityRef = 'user:default/test.user';
    const mockCredentials: BackstageCredentials<BackstageUserPrincipal> = {
      $$type: '@backstage/BackstageCredentials',
      principal: { type: 'user', userEntityRef: mockUserEntityRef },
    };

    const mockUserEmail = 'test.user@example.com';
    const mockIncidentsData = [{ id: 'INC001', description: 'Test incident' }];

    const mockUserEntity: UserEntity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'User',
      metadata: {
        name: 'test.user',
        namespace: 'default',
      },
      spec: {
        profile: {
          email: mockUserEmail,
        },
      },
    };

    it('should successfully retrieve incidents with query parameters', async () => {
      mockHttpAuthService.credentials.mockResolvedValue(mockCredentials);
      mockUserInfoService.getUserInfo.mockResolvedValue({
        userEntityRef: mockUserEntityRef,
        ownershipEntityRefs: [],
      });
      mockAuthService.getOwnServiceCredentials.mockResolvedValue({
        $$type: '@backstage/BackstageCredentials',
        principal: { type: 'service', subject: 'servicenow-backend' },
      });
      mockAuthService.getPluginRequestToken.mockResolvedValue({
        token: mockBareToken,
      });
      mockCatalogApi.getEntityByRef = jest
        .fn()
        .mockResolvedValue(mockUserEntity);
      mockFetchIncidents.mockResolvedValue(mockIncidentsData);

      const queryParams = {
        entityId: 'mock-entity-id',
        limit: 10,
        offset: 5,
        state: 'IN1',
        priority: 'IN1',
        search: 'network issue',
      };

      const response = await request(app)
        .get('/incidents')
        .query(queryParams)
        .set('Authorization', mockAuthHeader);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockIncidentsData);
      expect(mockHttpAuthService.credentials).toHaveBeenCalledWith(
        expect.anything(),
        { allow: ['user'] },
      );
      expect(mockUserInfoService.getUserInfo).toHaveBeenCalledWith(
        mockCredentials,
      );
      expect(mockAuthService.getOwnServiceCredentials).toHaveBeenCalledTimes(1);
      expect(mockAuthService.getPluginRequestToken).toHaveBeenCalledWith({
        onBehalfOf: {
          $$type: '@backstage/BackstageCredentials',
          principal: { type: 'service', subject: 'servicenow-backend' },
        },
        targetPluginId: 'catalog',
      });
      expect(mockCatalogApi.getEntityByRef).toHaveBeenCalledWith(
        mockUserEntityRef,
        { token: mockBareToken },
      );
      expect(mockFetchIncidents).toHaveBeenCalledWith(
        expect.objectContaining({
          userEmail: mockUserEmail,
          state: queryParams.state,
          priority: queryParams.priority,
          search: queryParams.search,
          limit: queryParams.limit,
          offset: queryParams.offset,
        }),
      );
    });

    it('should return 401 if Authorization header is missing (handled by HttpAuthService mock)', async () => {
      mockHttpAuthService.credentials.mockRejectedValue(
        new AuthenticationError('Missing credentials'),
      );
      const response = await request(app).get('/incidents');
      expect(response.status).toBe(401);
      expect(response.body.error.name).toBe('AuthenticationError');
      expect(response.body.error.message).toBe('Missing credentials');
      expect(mockFetchIncidents).not.toHaveBeenCalled();
    });

    it('should return 401 if HttpAuthService.credentials throws AuthenticationError', async () => {
      mockHttpAuthService.credentials.mockRejectedValue(
        new AuthenticationError('Invalid token'),
      );
      const response = await request(app)
        .get('/incidents')
        .set('Authorization', 'Bearer invalid-token');
      expect(response.status).toBe(401);
      expect(response.body.error.name).toBe('AuthenticationError');
      expect(response.body.error.message).toBe('Invalid token');
      expect(mockFetchIncidents).not.toHaveBeenCalled();
    });

    it('should return 500 if UserInfoService.getUserInfo fails', async () => {
      mockHttpAuthService.credentials.mockResolvedValue(mockCredentials);
      mockUserInfoService.getUserInfo.mockRejectedValue(
        new Error('UserInfoService internal failure'),
      );
      const response = await request(app)
        .get('/incidents?entityId=mock-entity-id&state=1')
        .set('Authorization', mockAuthHeader);
      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe(
        'UserInfoService internal failure',
      );
      expect(mockFetchIncidents).not.toHaveBeenCalled();
    });

    it('should return 400 if userEntityRef is missing from UserInfo', async () => {
      mockHttpAuthService.credentials.mockResolvedValue(mockCredentials);
      // Missing userEntityRef
      mockUserInfoService.getUserInfo.mockResolvedValue({
        ownershipEntityRefs: [],
      } as any);
      const response = await request(app)
        .get('/incidents?entityId=mock-entity-for-failure-test')
        .set('Authorization', mockAuthHeader);
      expect(response.status).toBe(400);
      expect(response.body.error.name).toBe('InputError');
      expect(response.body.error.message).toContain(
        'User entity reference not found in user info',
      );
      expect(mockFetchIncidents).not.toHaveBeenCalled();
    });

    it('should return 401 if AuthService.getPluginRequestToken fails (e.g. returns undefined token)', async () => {
      mockHttpAuthService.credentials.mockResolvedValue(mockCredentials);
      mockUserInfoService.getUserInfo.mockResolvedValue({
        userEntityRef: mockUserEntityRef,
        ownershipEntityRefs: [],
      });
      mockAuthService.getOwnServiceCredentials.mockResolvedValue({
        $$type: '@backstage/BackstageCredentials',
        principal: { type: 'service', subject: 'servicenow-backend' },
      });
      // Simulate missing plugin token
      mockAuthService.getPluginRequestToken.mockResolvedValue({
        token: undefined,
      } as any);
      const response = await request(app)
        .get('/incidents?entityId=mock-entity-for-failure-test')
        .set('Authorization', mockAuthHeader);
      expect(response.status).toBe(401); // Or appropriate error based on router logic
      expect(response.body.error.name).toBe('AuthenticationError');
      expect(response.body.error.message).toContain(
        'Plugin token is missing or invalid',
      );
      expect(mockFetchIncidents).not.toHaveBeenCalled();
    });

    it('should return 404 if CatalogApi.getEntityByRef returns undefined', async () => {
      mockHttpAuthService.credentials.mockResolvedValue(mockCredentials);
      mockUserInfoService.getUserInfo.mockResolvedValue({
        userEntityRef: mockUserEntityRef,
        ownershipEntityRefs: [],
      });
      mockAuthService.getOwnServiceCredentials.mockResolvedValue({
        $$type: '@backstage/BackstageCredentials',
        principal: { type: 'service', subject: 'servicenow-backend' },
      });
      mockAuthService.getPluginRequestToken.mockResolvedValue({
        token: mockBareToken,
      });
      mockCatalogApi.getEntityByRef = jest.fn().mockResolvedValue(undefined);
      const response = await request(app)
        .get('/incidents?entityId=mock-entity-for-failure-test')
        .set('Authorization', mockAuthHeader);
      expect(response.status).toBe(404);
      expect(response.body.error.name).toBe('NotFoundError');
      expect(response.body.error.message).toContain(
        `User entity not found for ref: ${mockUserEntityRef}`,
      );
      expect(mockFetchIncidents).not.toHaveBeenCalled();
    });

    it('should return 404 if CatalogApi.getEntityByRef throws NotFoundError', async () => {
      mockHttpAuthService.credentials.mockResolvedValue(mockCredentials);
      mockUserInfoService.getUserInfo.mockResolvedValue({
        userEntityRef: mockUserEntityRef,
        ownershipEntityRefs: [],
      });
      mockAuthService.getOwnServiceCredentials.mockResolvedValue({
        $$type: '@backstage/BackstageCredentials',
        principal: { type: 'service', subject: 'servicenow-backend' },
      });
      mockAuthService.getPluginRequestToken.mockResolvedValue({
        token: mockBareToken,
      });
      mockCatalogApi.getEntityByRef = jest
        .fn()
        .mockRejectedValue(
          new NotFoundError('Catalog entity explicitly not found'),
        );
      const response = await request(app)
        .get('/incidents?entityId=mock-entity-for-failure-test')
        .set('Authorization', mockAuthHeader);
      expect(response.status).toBe(404);
      expect(response.body.error.name).toBe('NotFoundError');
      expect(response.body.error.message).toBe(
        'Catalog entity explicitly not found',
      );
      expect(mockFetchIncidents).not.toHaveBeenCalled();
    });

    it('should return 500 if CatalogApi.getEntityByRef fails with a generic error', async () => {
      mockHttpAuthService.credentials.mockResolvedValue(mockCredentials);
      mockUserInfoService.getUserInfo.mockResolvedValue({
        userEntityRef: mockUserEntityRef,
        ownershipEntityRefs: [],
      });
      mockAuthService.getOwnServiceCredentials.mockResolvedValue({
        $$type: '@backstage/BackstageCredentials',
        principal: { type: 'service', subject: 'servicenow-backend' },
      });
      mockAuthService.getPluginRequestToken.mockResolvedValue({
        token: mockBareToken,
      });
      mockCatalogApi.getEntityByRef = jest
        .fn()
        .mockRejectedValue(new Error('CatalogApi generic failure'));
      const response = await request(app)
        .get('/incidents')
        .query({ entityId: 'mock-entity-for-test' })
        .set('Authorization', mockAuthHeader);
      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe('CatalogApi generic failure');
      expect(mockFetchIncidents).not.toHaveBeenCalled();
    });

    it('should return 404 if user entity lacks spec.profile.email', async () => {
      const userEntityWithoutEmail: UserEntity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'User',
        metadata: { name: 'test.user', namespace: 'default' },
        spec: { profile: {} },
      };
      mockHttpAuthService.credentials.mockResolvedValue(mockCredentials);
      mockUserInfoService.getUserInfo.mockResolvedValue({
        userEntityRef: mockUserEntityRef,
        ownershipEntityRefs: [],
      });
      mockAuthService.getOwnServiceCredentials.mockResolvedValue({
        $$type: '@backstage/BackstageCredentials',
        principal: { type: 'service', subject: 'servicenow-backend' },
      });
      mockAuthService.getPluginRequestToken.mockResolvedValue({
        token: mockBareToken,
      });
      mockCatalogApi.getEntityByRef = jest
        .fn()
        .mockResolvedValue(userEntityWithoutEmail);
      const response = await request(app)
        .get('/incidents')
        .query({ entityId: 'mock-entity-for-test' })
        .set('Authorization', mockAuthHeader);
      expect(response.status).toBe(404);
      expect(response.body.error.name).toBe('NotFoundError');
      expect(response.body.error.message).toContain(
        `Email not found for user ${mockUserEntityRef}`,
      );
      expect(mockFetchIncidents).not.toHaveBeenCalled();
    });

    it('should return 404 if user entity has undefined email', async () => {
      const userEntityWithUndefinedEmail: UserEntity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'User',
        metadata: { name: 'test.user', namespace: 'default' },
        spec: { profile: { email: undefined } },
      };
      mockHttpAuthService.credentials.mockResolvedValue(mockCredentials);
      mockUserInfoService.getUserInfo.mockResolvedValue({
        userEntityRef: mockUserEntityRef,
        ownershipEntityRefs: [],
      });
      mockAuthService.getOwnServiceCredentials.mockResolvedValue({
        $$type: '@backstage/BackstageCredentials',
        principal: { type: 'service', subject: 'servicenow-backend' },
      });
      mockAuthService.getPluginRequestToken.mockResolvedValue({
        token: mockBareToken,
      });
      mockCatalogApi.getEntityByRef = jest
        .fn()
        .mockResolvedValue(userEntityWithUndefinedEmail);
      const response = await request(app)
        .get('/incidents')
        .query({ entityId: 'mock-entity-for-test' })
        .set('Authorization', mockAuthHeader);
      expect(response.status).toBe(404);
      expect(response.body.error.name).toBe('NotFoundError');
      expect(response.body.error.message).toContain(
        `Email not found for user ${mockUserEntityRef}`,
      );
      expect(mockFetchIncidents).not.toHaveBeenCalled();
    });

    it('should return 404 if user entity from catalog lacks spec.profile (thus no email)', async () => {
      const userEntityWithoutProfile: UserEntity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'User',
        metadata: { name: 'test.user', namespace: 'default' },
        spec: {
          memberOf: [],
        },
      };

      mockHttpAuthService.credentials.mockResolvedValue(mockCredentials);
      mockUserInfoService.getUserInfo.mockResolvedValue({
        userEntityRef: mockUserEntityRef,
        ownershipEntityRefs: [],
      });
      mockAuthService.getOwnServiceCredentials.mockResolvedValue({
        $$type: '@backstage/BackstageCredentials',
        principal: { type: 'service', subject: 'servicenow-backend' },
      });
      mockAuthService.getPluginRequestToken.mockResolvedValue({
        token: mockBareToken,
      });
      mockCatalogApi.getEntityByRef = jest
        .fn()
        .mockResolvedValue(userEntityWithoutProfile);

      const response = await request(app)
        .get('/incidents')
        .query({ entityId: 'mock-entity-for-test' })
        .set('Authorization', mockAuthHeader);

      expect(response.status).toBe(404);
      expect(response.body.error.name).toBe('NotFoundError');
      expect(response.body.error.message).toContain(
        `Email not found for user ${mockUserEntityRef}`,
      );
      expect(mockFetchIncidents).not.toHaveBeenCalled();
    });

    it('should return 500 if ServiceNowClient.fetchIncidents fails', async () => {
      mockHttpAuthService.credentials.mockResolvedValue(mockCredentials);
      mockUserInfoService.getUserInfo.mockResolvedValue({
        userEntityRef: mockUserEntityRef,
        ownershipEntityRefs: [],
      });
      mockAuthService.getOwnServiceCredentials.mockResolvedValue({
        $$type: '@backstage/BackstageCredentials',
        principal: { type: 'service', subject: 'servicenow-backend' },
      });
      mockAuthService.getPluginRequestToken.mockResolvedValue({
        token: mockBareToken,
      });
      mockCatalogApi.getEntityByRef = jest
        .fn()
        .mockResolvedValue(mockUserEntity);
      mockFetchIncidents.mockRejectedValue(
        new Error('ServiceNow client fetch failure'),
      );
      const response = await request(app)
        .get('/incidents')
        .query({ entityId: 'mock-entity-for-test' })
        .set('Authorization', mockAuthHeader);
      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe(
        'Failed to fetch incidents from ServiceNow',
      );
    });

    it('should return 400 for invalid limit parameter (e.g., "abc")', async () => {
      mockHttpAuthService.credentials.mockResolvedValue(mockCredentials);
      mockUserInfoService.getUserInfo.mockResolvedValue({
        userEntityRef: mockUserEntityRef,
        ownershipEntityRefs: [],
      });
      mockAuthService.getOwnServiceCredentials.mockResolvedValue({
        $$type: '@backstage/BackstageCredentials',
        principal: { type: 'service', subject: 'servicenow-backend' },
      });
      mockAuthService.getPluginRequestToken.mockResolvedValue({
        token: mockBareToken,
      });
      mockCatalogApi.getEntityByRef = jest
        .fn()
        .mockResolvedValue(mockUserEntity);
      const response = await request(app)
        .get('/incidents?entityId=mock-entity-id&limit=abc')
        .set('Authorization', mockAuthHeader);
      expect(response.status).toBe(400);
      expect(response.body.error.name).toBe('InputError');
      expect(response.body.error.message).toBe(
        'limit must be a non-negative integer.',
      );
    });

    it('should return 400 for negative limit parameter (e.g., -1)', async () => {
      mockHttpAuthService.credentials.mockResolvedValue(mockCredentials);
      mockUserInfoService.getUserInfo.mockResolvedValue({
        userEntityRef: mockUserEntityRef,
        ownershipEntityRefs: [],
      });
      mockAuthService.getOwnServiceCredentials.mockResolvedValue({
        $$type: '@backstage/BackstageCredentials',
        principal: { type: 'service', subject: 'servicenow-backend' },
      });
      mockAuthService.getPluginRequestToken.mockResolvedValue({
        token: mockBareToken,
      });
      mockCatalogApi.getEntityByRef = jest
        .fn()
        .mockResolvedValue(mockUserEntity);
      const response = await request(app)
        .get('/incidents?entityId=mock-entity-id&limit=-1')
        .set('Authorization', mockAuthHeader);
      expect(response.status).toBe(400);
      expect(response.body.error.name).toBe('InputError');
      expect(response.body.error.message).toBe(
        'limit must be a non-negative integer.',
      );
    });

    it('should return 400 for invalid offset parameter (e.g., "xyz")', async () => {
      mockHttpAuthService.credentials.mockResolvedValue(mockCredentials);
      mockUserInfoService.getUserInfo.mockResolvedValue({
        userEntityRef: mockUserEntityRef,
        ownershipEntityRefs: [],
      });
      mockAuthService.getOwnServiceCredentials.mockResolvedValue({
        $$type: '@backstage/BackstageCredentials',
        principal: { type: 'service', subject: 'servicenow-backend' },
      });
      mockAuthService.getPluginRequestToken.mockResolvedValue({
        token: mockBareToken,
      });
      mockCatalogApi.getEntityByRef = jest
        .fn()
        .mockResolvedValue(mockUserEntity);
      const response = await request(app)
        .get('/incidents?entityId=mock-entity-id&offset=xyz')
        .set('Authorization', mockAuthHeader);
      expect(response.status).toBe(400);
      expect(response.body.error.name).toBe('InputError');
      expect(response.body.error.message).toBe(
        'offset must be a non-negative integer.',
      );
    });

    it('should return 400 for negative offset parameter (e.g., -5)', async () => {
      mockHttpAuthService.credentials.mockResolvedValue(mockCredentials);
      mockUserInfoService.getUserInfo.mockResolvedValue({
        userEntityRef: mockUserEntityRef,
        ownershipEntityRefs: [],
      });
      mockAuthService.getOwnServiceCredentials.mockResolvedValue({
        $$type: '@backstage/BackstageCredentials',
        principal: { type: 'service', subject: 'servicenow-backend' },
      });
      mockAuthService.getPluginRequestToken.mockResolvedValue({
        token: mockBareToken,
      });
      mockCatalogApi.getEntityByRef = jest
        .fn()
        .mockResolvedValue(mockUserEntity);
      const response = await request(app)
        .get('/incidents?entityId=mock-entity-id&offset=-5')
        .set('Authorization', mockAuthHeader);
      expect(response.status).toBe(400);
      expect(response.body.error.name).toBe('InputError');
      expect(response.body.error.message).toBe(
        'offset must be a non-negative integer.',
      );
    });

    it('should return 400 if state parameter does not use IN prefix', async () => {
      mockHttpAuthService.credentials.mockResolvedValue(mockCredentials);
      mockUserInfoService.getUserInfo.mockResolvedValue({
        userEntityRef: mockUserEntityRef,
        ownershipEntityRefs: [],
      });
      mockAuthService.getOwnServiceCredentials.mockResolvedValue({
        $$type: '@backstage/BackstageCredentials',
        principal: { type: 'service', subject: 'servicenow-backend' },
      });
      mockAuthService.getPluginRequestToken.mockResolvedValue({
        token: mockBareToken,
      });
      mockCatalogApi.getEntityByRef = jest
        .fn()
        .mockResolvedValue(mockUserEntity);

      const response = await request(app)
        .get('/incidents')
        .query({ entityId: 'mock-entity-id', state: '1' })
        .set('Authorization', mockAuthHeader);

      expect(response.status).toBe(400);
      expect(response.body.error.name).toBe('InputError');
      expect(response.body.error.message).toBe(
        "Query parameter 'state' must use the 'IN' prefix format (e.g., 'INvalue1,value2' or 'INvalue').",
      );
      expect(mockFetchIncidents).not.toHaveBeenCalled();
    });

    it('should return 400 if priority parameter does not use IN prefix', async () => {
      mockHttpAuthService.credentials.mockResolvedValue(mockCredentials);
      mockUserInfoService.getUserInfo.mockResolvedValue({
        userEntityRef: mockUserEntityRef,
        ownershipEntityRefs: [],
      });
      mockAuthService.getOwnServiceCredentials.mockResolvedValue({
        $$type: '@backstage/BackstageCredentials',
        principal: { type: 'service', subject: 'servicenow-backend' },
      });
      mockAuthService.getPluginRequestToken.mockResolvedValue({
        token: mockBareToken,
      });
      mockCatalogApi.getEntityByRef = jest
        .fn()
        .mockResolvedValue(mockUserEntity);

      const response = await request(app)
        .get('/incidents')
        .query({ entityId: 'mock-entity-id', priority: '1' })
        .set('Authorization', mockAuthHeader);

      expect(response.status).toBe(400);
      expect(response.body.error.name).toBe('InputError');
      expect(response.body.error.message).toBe(
        "Query parameter 'priority' must use the 'IN' prefix format (e.g., 'INvalue1,value2' or 'INvalue').",
      );
      expect(mockFetchIncidents).not.toHaveBeenCalled();
    });
  });
});
