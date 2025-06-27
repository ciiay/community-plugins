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
import { parseEntityRef, UserEntity } from '@backstage/catalog-model';
import { useLocation } from 'react-router-dom';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';

const useUserEmail = (): string | undefined => {
  const { pathname } = useLocation();
  const catalogApi = useApi(catalogApiRef);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profileLink, setProfileLink] = useState<string | null>(null);

  const { backstageIdentity, profile, loading } = useUserProfile();

  useEffect(() => {
    if (loading) return;
    const fetchUserEntity = async () => {
      if (!backstageIdentity?.userEntityRef) {
        setUserEmail(null);
        setProfileLink(null);
        return;
      }

      try {
        const { namespace = 'default', name } = parseEntityRef(
          backstageIdentity.userEntityRef,
        );
        const profileUrl = `/catalog/${namespace}/user/${name}`;
        setProfileLink(profileUrl);

        const userEntity = await catalogApi.getEntityByRef(
          backstageIdentity.userEntityRef,
        );

        const userProfile = userEntity as UserEntity;
        const email =
          profile?.email ?? userProfile?.spec?.profile?.email ?? null;

        setUserEmail(email);
      } catch (error) {
        setUserEmail(null);
        setProfileLink(null);
      }
    };

    fetchUserEntity();
  }, [loading, backstageIdentity?.userEntityRef, catalogApi, profile?.email]);

  const isOnProfilePage =
    profileLink &&
    (pathname === profileLink || pathname.startsWith(`${profileLink}/`));

  return isOnProfilePage ? userEmail ?? undefined : undefined;
};

export default useUserEmail;
