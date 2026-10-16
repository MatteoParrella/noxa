/** Maschera un indirizzo per mostrarlo a schermo: giulia.rota@example.com → g•••@example.com. */
export function mascheraEmail(email: string): string {
  const chiocciola = email.lastIndexOf('@');
  if (chiocciola < 1) return '•••';
  return `${email.slice(0, 1)}•••${email.slice(chiocciola)}`;
}
