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

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useQueryState<T>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const getValueFromParams = useCallback(
    (raw: string | null): T => {
      if (typeof defaultValue === 'number')
        return (raw ? Number(raw) : defaultValue) as T;
      if (typeof defaultValue === 'boolean') return (raw === 'true') as T;
      return (raw as T) ?? defaultValue;
    },
    [defaultValue],
  );

  const [state, setState] = useState<T>(() =>
    getValueFromParams(searchParams.get(key)),
  );

  useEffect(() => {
    const paramValue = getValueFromParams(searchParams.get(key));
    setState(paramValue);
  }, [getValueFromParams, searchParams, key]);

  const setValue = useCallback(
    (newValue: T) => {
      setSearchParams(
        prev => {
          const params = new URLSearchParams(prev);
          params.set(key, String(newValue));
          return params;
        },
        { replace: true },
      );

      setState(newValue);
    },
    [key, setSearchParams],
  );

  return [state, setValue];
}
