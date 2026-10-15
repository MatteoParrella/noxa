import { render, screen } from '@testing-library/react';
import Home from '@/app/page';

describe('Home', () => {
  it('mostra il nome dell’app come titolo principale', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1, name: 'Noxa' })).toBeInTheDocument();
  });
});
