#!/usr/bin/env node
// Fails if tracked files look like they contain secrets.
// Run before committing: npm run check:secrets
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((f) => !f.endsWith('package-lock.json') && !/\.(png|jpg|jpeg|webp|ico)$/i.test(f))

const forbiddenFiles = [/(^|\/)\.env(\.|$)(?!example$)/, /(^|\/)\.env\.local$/, /\.pem$/, /\.p12$/, /id_rsa/]

const patterns = [
  { name: 'JSON Web Token (Supabase anon/service key)', re: /eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'Supabase secret key', re: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: 'service role key assignment', re: /SERVICE_ROLE_KEY\s*=\s*\S{10,}/ },
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'VAPID private key assignment', re: /VAPID_PRIVATE_KEY\s*=\s*\S{10,}/ },
  { name: 'Postgres URL with a non-local password', re: /postgres(ql)?:\/\/[^:\s]+:(?!postgres@)[^@\s]{6,}@(?!127\.0\.0\.1|localhost)/ },
]

const problems = []
for (const file of files) {
  if (forbiddenFiles.some((re) => re.test(file))) {
    problems.push(`${file}: this kind of file must not be committed`)
    continue
  }
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  for (const { name, re } of patterns) {
    if (re.test(text)) problems.push(`${file}: possible ${name}`)
  }
}

if (problems.length) {
  console.error('Possible secrets found:\n' + problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}
console.log(`No secrets found in ${files.length} tracked files.`)
