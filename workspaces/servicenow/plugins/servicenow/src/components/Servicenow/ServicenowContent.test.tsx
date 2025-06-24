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

import { EntityProvider } from '@backstage/plugin-catalog-react';
import { screen, waitFor } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { ServiceAnnotationFieldName } from '@backstage-community/plugin-servicenow-common';
import { serviceNowApiRef } from '../../api/ServiceNowBackendClient';
import { mockIncidents } from '../../mocks/mockData';
import userEvent from '@testing-library/user-event';
import { ServicenowContent } from './ServicenowContent';

const mockEntity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'mock-component',
    annotations: {
      [ServiceAnnotationFieldName]: 'service-id-123',
    },
  },
};

jest.mock('react-router-dom', () => {
  const originalModule = jest.requireActual('react-router-dom');
  return {
    ...originalModule,
    useSearchParams: () => {
      const params = new URLSearchParams();
      const setSearchParams = jest.fn();
      return [params, setSearchParams];
    },
  };
});

jest.mock('../../hooks/useDebouncedValue', () => ({
  useDebouncedValue: (value: string) => value,
}));

jest.mock('../../hooks/useQueryState', () => ({
  useQueryState: (_: string, defaultValue: any) => {
    return [defaultValue, jest.fn()];
  },
}));

describe('ServicenowContent', () => {
  const mockServiceNowApi = {
    getIncidents: jest.fn(),
  };

  beforeEach(() => {
    mockServiceNowApi.getIncidents.mockReset();
    mockServiceNowApi.getIncidents.mockResolvedValue(mockIncidents);
  });

  it('renders the table with incident rows', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[serviceNowApiRef, mockServiceNowApi]]}>
        <EntityProvider entity={mockEntity}>
          <ServicenowContent />
        </EntityProvider>
      </TestApiProvider>,
    );

    await waitFor(() => {
      expect(mockServiceNowApi.getIncidents).toHaveBeenCalled();
    });

    expect(mockServiceNowApi.getIncidents).toHaveBeenCalledTimes(1);

    expect(
      await screen.findByText(mockIncidents[0].number),
    ).toBeInTheDocument();

    expect(
      screen.getByText(`ServiceNow tickets (${mockIncidents.length})`),
    ).toBeInTheDocument();

    // First page of incidents
    mockIncidents.slice(0, 5).forEach(incident => {
      expect(screen.getByText(incident.number)).toBeInTheDocument();
    });
  });

  it('displays pagination dropdown', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[serviceNowApiRef, mockServiceNowApi]]}>
        <EntityProvider entity={mockEntity}>
          <ServicenowContent />
        </EntityProvider>
      </TestApiProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(`ServiceNow tickets (${mockIncidents.length})`),
      ).toBeInTheDocument();
    });

    const dropdowns = screen.getAllByRole('combobox');
    const paginationDropdown = dropdowns.find(el =>
      el.textContent?.includes('5 rows'),
    );
    expect(paginationDropdown).toBeInTheDocument();
  });

  it('shows empty content placeholder when no incidents are available', async () => {
    mockServiceNowApi.getIncidents.mockResolvedValue([]);

    await renderInTestApp(
      <TestApiProvider apis={[[serviceNowApiRef, mockServiceNowApi]]}>
        <EntityProvider entity={mockEntity}>
          <ServicenowContent />
        </EntityProvider>
      </TestApiProvider>,
    );

    await waitFor(() => {
      expect(mockServiceNowApi.getIncidents).toHaveBeenCalled();
    });
    expect(mockServiceNowApi.getIncidents).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByTestId('no-incidents-found')).toBeInTheDocument();
    });
  });

  it('handles search input updates', async () => {
    const user = userEvent.setup();
    await renderInTestApp(
      <TestApiProvider apis={[[serviceNowApiRef, mockServiceNowApi]]}>
        <EntityProvider entity={mockEntity}>
          <ServicenowContent />
        </EntityProvider>
      </TestApiProvider>,
    );

    await waitFor(() => {
      expect(mockServiceNowApi.getIncidents).toHaveBeenCalled();
    });

    expect(
      await screen.findByText(mockIncidents[0].number),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Search');
    await user.type(input, 'INC001');
    expect(input).toHaveValue('INC001');
  });
});
