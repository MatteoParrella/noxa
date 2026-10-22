import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Avatar } from '@/components/ui/Avatar';

const createSignedUrl = vi.fn(async (percorso: string) =>
  percorso.includes('negata')
    ? { data: null, error: { message: 'Object not found', statusCode: '400' } }
    : { data: { signedUrl: `https://storage.noxa.test/${percorso}` }, error: null },
);

vi.mock('@/lib/supabase', () => ({
  supabase: () => ({ storage: { from: () => ({ createSignedUrl }) } }),
}));

function conCache(figli: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{figli}</QueryClientProvider>;
}

const PERCORSO = '00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000002.webp';

describe('Avatar con la foto profilo', () => {
  it('mostra la foto al posto delle iniziali quando la persona ne ha una', async () => {
    const { container } = render(conCache(<Avatar nome="Giulia Rota" foto={PERCORSO} />));
    const immagine = await vi.waitFor(() => {
      const img = container.querySelector('img.avatar-foto');
      if (!img) throw new Error('foto non ancora mostrata');
      return img;
    });
    expect(immagine.getAttribute('src')).toBe(`https://storage.noxa.test/${PERCORSO}`);
    expect(screen.getByRole('img', { name: 'Giulia Rota' })).not.toHaveTextContent('GR');
  });

  it('senza foto mostra le iniziali e non chiede nulla allo storage', () => {
    createSignedUrl.mockClear();
    render(conCache(<Avatar nome="Giulia Rota" foto={null} />));
    expect(screen.getByRole('img', { name: 'Giulia Rota' })).toHaveTextContent('GR');
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('se lo storage nega la foto (nascosta o non visibile) restano le iniziali', async () => {
    render(conCache(<Avatar nome="Giulia Rota" foto="negata/foto.webp" />));
    await vi.waitFor(() => expect(createSignedUrl).toHaveBeenCalledWith('negata/foto.webp', 3600));
    expect(screen.getByRole('img', { name: 'Giulia Rota' })).toHaveTextContent('GR');
  });

  it('se il file non si carica torna alle iniziali', async () => {
    const { container } = render(conCache(<Avatar nome="Giulia Rota" foto={PERCORSO} />));
    const immagine = await vi.waitFor(() => {
      const img = container.querySelector('img.avatar-foto');
      if (!img) throw new Error('foto non ancora mostrata');
      return img;
    });
    fireEvent.error(immagine);
    expect(screen.getByRole('img', { name: 'Giulia Rota' })).toHaveTextContent('GR');
  });
});
