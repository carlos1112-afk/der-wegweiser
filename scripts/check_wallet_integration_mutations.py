#!/usr/bin/env python3
"""Selected integration guards; not a replacement for full Stryker or Firestore emulator verification."""
import json
import os
import pathlib
import subprocess
import tempfile
root = pathlib.Path(__file__).resolve().parents[1]
target = root / 'functions/src/wallet/firestoreLedger.ts'
original = target.read_text()
mutations = {
    'deletion admission guard removed': ('if (deletion.exists && !cleanup)', 'if (false)'),
    'writer pause removed': ("if (!cleanup && (control.data()?.state !== 'active' || control.data()?.schemaVersion !== 1))", "if (!cleanup && control.data()?.state === '__mutation_disabled__')"),
    'operation identity collapsed': ('JSON.stringify([uid, operation, reference])', "JSON.stringify([uid, 'same', reference])"),
    'migration pause removed': ("if (control.data()?.state !== 'paused')", "if (control.data()?.state === '__mutation_disabled__')"),
    'capture treated as cleanup': ("const cleanup = input.operation === 'release';", "const cleanup = input.operation === 'capture';"),
    'account balance write removed': ('transaction.set(accountRef, { userId: uid, ...result.wallet }, { merge: true });', 'void accountRef;'),
}
results = []
try:
    with tempfile.TemporaryDirectory(prefix='wegweiser-ledger-integration-') as directory:
        for index, (name, change) in enumerate([('baseline', None), *mutations.items()]):
            if change:
                old, new = change
                if original.count(old) != 1:
                    raise RuntimeError(f'{name}: ambiguous mutation')
                target.write_text(original.replace(old, new))
            else:
                target.write_text(original)
            output = pathlib.Path(directory) / f'{index}.json'
            command = [str(root / 'functions/node_modules/.bin/jest'), '--runInBand', 'tests/firestoreLedger.test.ts', 'tests/voucherLedger.test.ts', '--json', '--outputFile', str(output)]
            environment = os.environ.copy()
            environment['NODE_OPTIONS'] = (environment.get('NODE_OPTIONS', '') + ' --experimental-vm-modules').strip()
            run = subprocess.run(command, cwd=root / 'functions', capture_output=True, text=True, timeout=60, env=environment)
            if not output.exists():
                raise RuntimeError(f'{name}: missing test result: {run.stderr[-300:]}')
            result = json.loads(output.read_text())
            if result['numTotalTests'] < 14 or result.get('numRuntimeErrorTestSuites', 0):
                raise RuntimeError(f'{name}: infrastructure/compilation failure: {run.stderr[-500:]}')
            if not change:
                if run.returncode or result['numFailedTests']:
                    raise RuntimeError('baseline failed')
            else:
                killed = run.returncode != 0 and result['numFailedTests'] > 0
                results.append({'mutation': name, 'killed': killed})
                print(json.dumps(results[-1]), flush=True)
finally:
    target.write_text(original)
print(json.dumps({'selectedIntegrationMutations': len(results), 'killed': sum(r['killed'] for r in results)}))
if not all(r['killed'] for r in results):
    raise SystemExit(1)
