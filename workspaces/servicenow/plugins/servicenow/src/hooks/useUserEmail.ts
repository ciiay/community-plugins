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

import { useEffect, useState } from 'react';
import { useUserProfile } from '@backstage/plugin-user-settings';
import { UserEntity } from '@backstage/catalog-model';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';

const useUserEmail = (kind: string): string | undefined => {
  const catalogApi = useApi(catalogApiRef);

  const [userEmail, setUserEmail] = useState<string | null>(null);

  const { backstageIdentity, profile, loading } = useUserProfile();

  useEffect(() => {
    if (kind !== 'user') {
      setUserEmail(null);
      return;
    }

    if (loading) return;

    const fetchUserEntity = async () => {
      if (!backstageIdentity?.userEntityRef) {
        setUserEmail(null);
        return;
      }

      try {
        if (profile?.email) {
          setUserEmail(profile.email);
          return;
        }

        const userEntity = await catalogApi.getEntityByRef(
          backstageIdentity.userEntityRef,
        );

        const userProfile = userEntity as UserEntity;
        const email =
          profile?.email ?? userProfile?.spec?.profile?.email ?? null;

        setUserEmail(email);
      } catch (error) {
        setUserEmail(null);
      }
    };

    fetchUserEntity();
  }, [
    kind,
    loading,
    backstageIdentity?.userEntityRef,
    catalogApi,
    profile?.email,
  ]);

  return userEmail ?? undefined;
};

export default useUserEmail;
