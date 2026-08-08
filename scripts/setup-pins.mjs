import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const iterations = 210_000;
const pins = {
  'member-misiek': process.env.WARIATKOWO_MISIEK_PIN,
  'member-miska': process.env.WARIATKOWO_MISKA_PIN,
};
for (const [memberId, pin] of Object.entries(pins)) {
  if (!/^\d{4}$/.test(pin ?? '')) {
    console.error('Set a four-digit PIN for ' + memberId + ' in the documented environment variable.');
    process.exit(1);
  }
}
const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const statements = Object.entries(pins).map(([memberId, pin]) => {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(pin, Buffer.from(salt, 'hex'), iterations, 32, 'sha256').toString('hex');
  return [
    'UPDATE household_members SET pin_hash = ' + quote(hash),
    ', pin_salt = ' + quote(salt),
    ', pin_iterations = ' + iterations,
    ', updated_at = ' + quote(new Date().toISOString()),
    ' WHERE id = ' + quote(memberId) + ';',
    'DELETE FROM sessions WHERE member_id = ' + quote(memberId) + ';',
  ].join('');
}).join('\n');
const tempFile = join(tmpdir(), 'wariatkowo-pins-' + process.pid + '.sql');
writeFileSync(tempFile, statements, { encoding: 'utf8', mode: 0o600 });
const remote = process.argv.includes('--remote');
const wranglerBin = join(process.cwd(), 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const args = [wranglerBin, 'd1', 'execute', 'wariatkowo-db', remote ? '--remote' : '--local', '--yes', '--file', tempFile];
try {
  console.log('Updating PIN hashes in the ' + (remote ? 'remote' : 'local') + ' D1 database...');
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error('Wrangler failed to update the PIN hashes.');
    process.exit(result.status ?? 1);
  }
  console.log('PIN hashes updated for both household members. Existing sessions were revoked.');
} finally {
  rmSync(tempFile, { force: true });
}
