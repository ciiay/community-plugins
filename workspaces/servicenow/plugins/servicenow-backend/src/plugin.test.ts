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
  startTestBackend,
} from '@backstage/backend-test-utils';
import { servicenowPlugin } from './plugin';
import request from 'supertest';
import { catalogServiceMock } from '@backstage/plugin-catalog-node/testUtils';
import { ConfigReader } from '@backstage/config';
import {
  coreServices,
  createServiceFactory,
} from '@backstage/backend-plugin-api';

describe('plugin', () => {
  const mockConfig = new ConfigReader({
    servicenow: {
      instanceUrl: 'https://mock.service-now.com',
      oauth: {
        grantType: 'client_credentials',
        clientId: 'mockClientId',
        clientSecret: 'mockClientSecret',
      },
    },
  });

  it('should create and read TODO items', async () => {
    const { server } = await startTestBackend({
      features: [
        servicenowPlugin,
        catalogServiceMock.factory({ entities: [] }),
        createServiceFactory({
          service: coreServices.rootConfig,
          deps: {},
          factory: () => mockConfig,
        }),
      ],
    });

    await request(server).get('/api/servicenow/todos').expect(200, {
      items: [],
    });

    const createRes = await request(server)
      .post('/api/servicenow/todos')
      .send({ title: 'My Todo' });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toEqual({
      id: expect.any(String),
      title: 'My Todo',
      createdBy: mockCredentials.user().principal.userEntityRef,
      createdAt: expect.any(String),
    });

    const createdTodoItem = createRes.body;

    await request(server)
      .get('/api/servicenow/todos')
      .expect(200, {
        items: [createdTodoItem],
      });

    await request(server)
      .get(`/api/servicenow/todos/${createdTodoItem.id}`)
      .expect(200, createdTodoItem);
  });

  it('should create TODO item with catalog information', async () => {
    const { server } = await startTestBackend({
      features: [
        servicenowPlugin,
        catalogServiceMock.factory({
          entities: [
            {
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Component',
              metadata: {
                name: 'my-component',
                namespace: 'default',
                title: 'My Component',
              },
              spec: {
                type: 'service',
                owner: 'me',
              },
            },
          ],
        }),
        createServiceFactory({
          service: coreServices.rootConfig,
          deps: {},
          factory: () => mockConfig,
        }),
      ],
    });

    const createRes = await request(server)
      .post('/api/servicenow/todos')
      .send({ title: 'My Todo', entityRef: 'component:default/my-component' });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toEqual({
      id: expect.any(String),
      title: '[My Component] My Todo',
      createdBy: mockCredentials.user().principal.userEntityRef,
      createdAt: expect.any(String),
    });
  });
});
