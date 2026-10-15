import { redirect } from 'next/navigation';

/** L'app si apre su Scopri. */
export default function Home() {
  redirect('/scopri/');
}
