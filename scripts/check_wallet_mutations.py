#!/usr/bin/env python3
"""Curated guard mutations when Stryker's local listener is unavailable.
Not a full Stryker score. Restores the source in finally; tests must actually fail.
"""
import json
import pathlib
import subprocess
import tempfile

root = pathlib.Path(__file__).resolve().parents[1]
target = root / 'functions/src/wallet/ledger.ts'
original = target.read_text()
mutations = {
    'negative amount admitted': ('!integer(input.amount)', 'false'),
    'negative balance admitted': ('w.schemaVersion !== 1 || !integer(w.balance)', 'w.schemaVersion !== 1 || false'),
    'capture increases reserve': ("case 'capture':\n      requireReservation('reserved'); reservedDelta = -input.amount;", "case 'capture':\n      requireReservation('reserved'); reservedDelta = input.amount;"),
    'release does not restore balance': ("requireReservation('reserved'); balanceDelta = input.amount; reservedDelta = -input.amount;", "requireReservation('reserved'); balanceDelta = 0; reservedDelta = -input.amount;"),
    'replay ignores amount conflict': ('receipt.amount !== input.amount', 'false'),
    'account lock ignored': ("if (locked && input.operation !== 'release')", "if (false && input.operation !== 'release')"),
    'refund keeps captured state': ("state: 'refunded' }; break;", "state: 'captured' }; break;"),
}
results = []
try:
    with tempfile.TemporaryDirectory(prefix='wegweiser-wallet-mutations-') as directory:
        # Baseline is mandatory: infrastructure or compile failure must never count as a killed mutant.
        for index, (name, change) in enumerate([('baseline', None), *mutations.items()]):
            if change:
                old, new = change
                if original.count(old) != 1:
                    raise RuntimeError(f'{name}: replacement must match exactly once')
                target.write_text(original.replace(old, new))
            else:
                target.write_text(original)
            output = pathlib.Path(directory) / f'{index}.json'
            command = [str(root / 'functions/node_modules/.bin/jest'), '--runInBand', 'tests/walletLedger.test.ts', '--json', '--outputFile', str(output)]
            run = subprocess.run(command, cwd=root / 'functions', capture_output=True, text=True, timeout=60)
            if not output.exists():
                raise RuntimeError(f'{name}: no structured test result: {run.stderr[-500:]}')
            result = json.loads(output.read_text())
            if result['numTotalTests'] < 13 or result.get('numRuntimeErrorTestSuites', 0):
                raise RuntimeError(f'{name}: invalid test execution: {run.stderr[-500:]}')
            if not change:
                if run.returncode != 0 or result['numFailedTests']:
                    raise RuntimeError('baseline failed')
            else:
                killed = run.returncode != 0 and result['numFailedTests'] > 0
                results.append({'mutation': name, 'killed': killed})
                print(json.dumps(results[-1]), flush=True)
finally:
    target.write_text(original)
print(json.dumps({'curatedMutations': len(results), 'killed': sum(r['killed'] for r in results)}))
if not all(r['killed'] for r in results):
    raise SystemExit(1)
