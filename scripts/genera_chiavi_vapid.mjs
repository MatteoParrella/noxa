#!/usr/bin/env node
// Genera una coppia di chiavi VAPID per il Web Push (ADR-0026), gratuite e solo locali.
// La chiave pubblica va in NEXT_PUBLIC_VAPID_PUBLIC_KEY (app) e in VAPID_PUBLIC_KEY (Edge
// Function invia-push); la privata solo in VAPID_PRIVATE_KEY con `supabase secrets set`, mai nel
// repository né in una variabile NEXT_PUBLIC_*.
import { generateKeyPairSync } from 'node:crypto';

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = privateKey.export({ format: 'jwk' });
const pubblica = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(jwk.x, 'base64url'),
  Buffer.from(jwk.y, 'base64url'),
]).toString('base64url');

process.stdout.write(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${pubblica}\n`);
process.stdout.write(`VAPID_PUBLIC_KEY=${pubblica}\n`);
process.stdout.write(`VAPID_PRIVATE_KEY=${jwk.d}\n`);
