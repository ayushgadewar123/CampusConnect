import { render, screen } from '@testing-library/react';
import App from './App';

test('renders CampusConnect shell', () => {
  render(<App />);
  expect(screen.getByText(/Event portal/i)).toBeInTheDocument();
});
