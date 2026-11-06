/** Corrige domínios digitados errado com frequência (ex.: gmail.com.br, que não existe). */
const TYPO_DOMAINS: Record<string, string> = {
  'gmail.com.br': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
}

export function suggestEmail(email: string): string | null {
  const [user, domain] = email.split('@')
  if (!user || !domain) return null
  const fix = TYPO_DOMAINS[domain]
  return fix ? `${user}@${fix}` : null
}
