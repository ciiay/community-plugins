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
import { default as React } from 'react';
import { screen } from '@testing-library/react';
import { ServicenowContent } from './ServicenowContent';
import { renderInTestApp } from '@backstage/test-utils';
import { mockIncidents } from '../../mocks/mockData';
import userEvent from '@testing-library/user-event';

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
  it('renders the table with incident rows', async () => {
    await renderInTestApp(<ServicenowContent />);

    expect(
      screen.getByText(`ServiceNow tickets (${mockIncidents.length})`),
    ).toBeInTheDocument();

    // First page of incidents
    mockIncidents.slice(0, 5).forEach(incident => {
      expect(screen.getByText(incident.number)).toBeInTheDocument();
    });
  });

  it('displays pagination dropdown', async () => {
    await renderInTestApp(<ServicenowContent />);
    const dropdowns = screen.getAllByRole('combobox');
    const paginationDropdown = dropdowns.find(el =>
      el.textContent?.includes('5 rows'),
    );
    expect(paginationDropdown).toBeInTheDocument();
  });

  it.skip('shows empty content placeholder when no incidents are available', async () => {
    // update this test when backend is ready
    jest.mock('../../mocks/mockData', () => ({
      mockIncidents: [],
    }));

    await renderInTestApp(<ServicenowContent />);
    expect(screen.getByTestId('no-incidents-found')).toBeInTheDocument();
  });

  it('handles search input updates', async () => {
    const user = userEvent.setup();
    await renderInTestApp(<ServicenowContent />);

    const input = screen.getByPlaceholderText('Search');
    await user.type(input, 'INC001');
    expect(input).toHaveValue('INC001');
  });
});
