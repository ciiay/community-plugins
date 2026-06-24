/*
 * Copyright 2024 The Backstage Authors
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
import { Entity, parseEntityRef } from '@backstage/catalog-model';
import { createApiFactory } from '@backstage/core-plugin-api';
import { createDevApp } from '@backstage/dev-utils';
import {
  CatalogEntityPage,
  CatalogIndexPage,
  catalogPlugin,
  EntityLayout,
  EntitySwitch,
} from '@backstage/plugin-catalog';
import { CatalogApi, catalogApiRef } from '@backstage/plugin-catalog-react';
import { SearchApi, searchApiRef } from '@backstage/plugin-search-react';
import { Grid } from '@backstage/ui';

// eslint-disable-next-line @backstage/no-ui-css-imports-in-non-frontend
import '@backstage/ui/css/styles.css';

import { ANNOTATION_PROVIDER_ID } from '@backstage-community/plugin-ocm-common';

import {
  ClusterAvailableResourceCard,
  ClusterContextProvider,
  ClusterInfoCard,
} from '../src';
import { OcmIcon, OcmPage, ocmPlugin } from '../src/plugin';

const clusterEntity = (name: string): Entity => ({
  apiVersion: 'backstage.io/v1beta1',
  kind: 'Resource',
  spec: { owner: 'unknown', type: 'kubernetes-cluster' },
  metadata: {
    name,
    namespace: 'default',
    annotations: {
      [ANNOTATION_PROVIDER_ID]: 'hub',
    },
  },
});

const isKubernetesCluster = (entity: Entity) =>
  entity.spec?.type === 'kubernetes-cluster';

const clusters = [
  clusterEntity('foo'),
  clusterEntity('cluster1'),
  clusterEntity('offline-cluster'),
];

const findClusterByRef = (
  ref: string | { kind: string; namespace?: string; name: string },
) => {
  const { kind, namespace, name } =
    typeof ref === 'string' ? parseEntityRef(ref) : ref;

  return clusters.find(
    entity =>
      entity.kind.toLowerCase() === kind.toLowerCase() &&
      (entity.metadata.namespace || 'default') === (namespace || 'default') &&
      entity.metadata.name === name,
  );
};

const matchesEntityFilter = (
  entity: Entity,
  filter: Record<string, unknown>,
) => {
  if (
    filter.kind &&
    entity.kind.toLowerCase() !== String(filter.kind).toLowerCase()
  ) {
    return false;
  }

  if (filter['spec.type'] && entity.spec?.type !== filter['spec.type']) {
    return false;
  }

  return true;
};

createDevApp()
  .registerPlugin(catalogPlugin)
  .registerApi({
    api: catalogApiRef,
    deps: {},
    factory: () =>
      ({
        async getEntities(request?: {
          filter?: Record<string, unknown> | Record<string, unknown>[];
        }) {
          const filter = request?.filter;
          const items =
            filter && !Array.isArray(filter)
              ? clusters.filter(entity => matchesEntityFilter(entity, filter))
              : clusters;

          return { items };
        },
        async getEntityByRef(
          ref: string | { kind: string; namespace?: string; name: string },
        ) {
          return findClusterByRef(ref);
        },
      } as CatalogApi),
  })
  .registerApi(
    createApiFactory({
      api: searchApiRef,
      deps: {},
      factory: () =>
        ({
          async query() {
            return new Promise(() => {});
          },
        } as SearchApi),
    }),
  )
  .registerPlugin(ocmPlugin)
  .addPage({
    element: <OcmPage />,
    title: 'Clusters',
    path: '/ocm',
    icon: OcmIcon,
  })
  .addPage({
    path: '/catalog',
    element: <CatalogIndexPage />,
  })
  .addPage({
    path: '/catalog/:namespace/:kind/:name',
    element: <CatalogEntityPage />,
    children: (
      <EntityLayout>
        <EntityLayout.Route path="/status" title="status">
          <EntitySwitch>
            <EntitySwitch.Case if={isKubernetesCluster}>
              <ClusterContextProvider>
                <Grid.Root
                  columns={{ sm: '12' }}
                  gap="4"
                  style={{ maxWidth: '50%' }}
                >
                  <Grid.Item colSpan={{ sm: '12' }}>
                    <ClusterInfoCard />
                  </Grid.Item>
                  <Grid.Item colSpan={{ sm: '12' }}>
                    <ClusterAvailableResourceCard />
                  </Grid.Item>
                </Grid.Root>
              </ClusterContextProvider>
            </EntitySwitch.Case>
          </EntitySwitch>
        </EntityLayout.Route>
      </EntityLayout>
    ),
  })
  .render();
