import type { ReactNode } from 'react';

/** Il template si rimonta a ogni cambio di area: la pagina entra con un breve movimento. */
export default function TemplateAree({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="pagina-entra">{children}</div>;
}
