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
import {
  StatusAborted,
  StatusError,
  StatusOK,
} from '@backstage/core-components';
import { ButtonLink, Flex, Text, Tooltip, TooltipTrigger } from '@backstage/ui';

import { RiArrowUpCircleLine } from '@remixicon/react';

import { ClusterStatus } from '@backstage-community/plugin-ocm-common';

import { versionDetails } from '../types';
import styles from './common.module.css';

export const Status = ({ status }: { status: ClusterStatus }) => {
  if (!status) {
    return <StatusAborted>Unknown</StatusAborted>;
  } else if (status.available) {
    return <StatusOK>Ready</StatusOK>;
  }
  return <StatusError>Not Ready</StatusError>;
};

export const Update = ({ data }: { data: versionDetails }) => {
  return (
    <>
      {data.update.available ? (
        <Flex direction="column">
          <Text>{data.version}</Text>
          <TooltipTrigger>
            <ButtonLink
              href={data.update.url}
              variant="secondary"
              className={styles.upgradeButton}
            >
              <Flex align="center" style={{ gap: 'var(--bui-space-1)' }}>
                <RiArrowUpCircleLine size={16} aria-hidden />
                Upgrade available
              </Flex>
            </ButtonLink>
            <Tooltip>{`Version ${data.update.version!} available`}</Tooltip>
          </TooltipTrigger>
        </Flex>
      ) : (
        data.version
      )}
    </>
  );
};
