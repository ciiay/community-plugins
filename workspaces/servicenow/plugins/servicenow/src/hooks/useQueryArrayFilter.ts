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

import { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SelectItem } from '@backstage/core-components';
import { INCIDENT_STATE_MAP, PRIORITY_MAP } from '../utils/incidentUtils';

export const useQueryArrayFilter = (filterName: string) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const current = useMemo(() => {
    const values = searchParams.get(filterName)?.split(',') ?? [];
    const map = filterName === 'state' ? INCIDENT_STATE_MAP : PRIORITY_MAP;

    return values
      .map(value => ({
        label: map[Number(value)]?.label,
        value,
      }))
      .filter(item => item.label);
  }, [filterName, searchParams]);

  const set = useCallback(
    (newValues: (string | number)[]) => {
      setSearchParams(
        params => {
          const newParams = new URLSearchParams(params);
          if (newValues.length > 0) {
            newParams.set(filterName, newValues.join(','));
          } else {
            newParams.delete(filterName);
          }
          return newParams;
        },
        { replace: true },
      );
    },
    [filterName, setSearchParams],
  );

  const clear = useCallback(() => {
    setSearchParams(
      params => {
        const newParams = new URLSearchParams(params);
        newParams.delete(filterName);
        return newParams;
      },
      { replace: true },
    );
  }, [filterName, setSearchParams]);

  return useMemo(
    () =>
      ({
        current,
        set,
        clear,
      } as const),
    [current, set, clear],
  );
};
