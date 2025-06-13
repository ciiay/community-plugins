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
  ClientCredentials,
  ResourceOwnerPassword,
  ModuleOptions,
  PasswordTokenConfig,
  ClientCredentialTokenConfig,
  AccessToken,
} from 'simple-oauth2';
import axios from 'axios';
import { ServiceNowSingleConfig } from '../config/config';

export async function fetchIncidents(config: ServiceNowSingleConfig) {
  if (!config.oauth) {
    throw new Error('Missing OAuth configuration');
  }

  const instanceUrl = config.instanceUrl.replace(/\/$/, '');
  const { grantType } = config.oauth;

  const determinedTokenUrl =
    config.oauth.tokenUrl ?? `${instanceUrl}/oauth_token.do`;
  const tokenHost = new URL(determinedTokenUrl).origin;
  const tokenPath = new URL(determinedTokenUrl).pathname;

  const { clientId, clientSecret } = config.oauth;

  const oauthConfig: ModuleOptions = {
    client: {
      id: clientId,
      secret: clientSecret,
    },
    auth: {
      tokenHost: tokenHost,
      tokenPath: tokenPath,
    },
    options: {
      authorizationMethod: 'body',
    },
  };

  let accessToken: AccessToken | undefined;
  if (grantType === 'client_credentials') {
    const client = new ClientCredentials(oauthConfig);
    const tokenCofing: ClientCredentialTokenConfig = {
      // scope: '',
    };
    accessToken = await client.getToken(tokenCofing);
  } else if (grantType === 'password') {
    const { username, password } = config.oauth;
    const client = new ResourceOwnerPassword(oauthConfig);
    const tokenCofing: PasswordTokenConfig = {
      //   scope: '',
      username: username,
      password: password,
    };
    accessToken = await client.getToken(tokenCofing);
  }

  if (!accessToken || !accessToken.token.access_token) {
    throw new Error('Failed to obtain access token');
  }

  const token = accessToken.token.access_token;

  const res = await axios.get(`${instanceUrl}/api/now/table/incident`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  console.log('==== Incidents:', res.data.result);
  return res.data.result;
}
