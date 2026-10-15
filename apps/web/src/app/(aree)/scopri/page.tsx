import type { Metadata } from 'next';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { VistaScopri } from '@/features/scopri/VistaScopri';

export const metadata: Metadata = { title: 'Scopri · Noxa' };

export default function PaginaScopri() {
  return (
    <>
      <IntestazioneArea sottotitolo="Milano e Brianza" titolo="Scopri" />
      <VistaScopri />
    </>
  );
}
