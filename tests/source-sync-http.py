"""Live, model-free source sync regression. run(call, project_dir, project) uses an authenticated
test client's call(name, arguments, sources=True). No credential is accepted on the command line.
The harness creates and trashes its disposable test project.
"""
from pathlib import Path


def run(call, project_dir, project):
    root = Path(project_dir)
    path = '_flow/flows/SourceSyncExample.flow.js'
    file = root / path
    good = 'function SourceSyncExample({ input, result }) { result.value = 42 }\n'
    bad = 'function SourceSyncExample({ input, result }) { result.value = }\n'
    checks = []

    def check(value, message):
        if not value:
            raise AssertionError(message)
        checks.append(message)

    def sc(response):
        return response.get('result', {}).get('structuredContent', {})

    def sync(**args):
        return call('flow-source-sync', dict(project=project, **args))

    baseline = sync(paths=[], dryRun=True)
    check(sc(baseline).get('ok'), 'baseline initialized without application')
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(good)
    response = sc(sync(dryRun=True))
    check(response.get('ok') and response['summary'] == {'checked': 1, 'applied': 0, 'refused': 0},
          'new valid Flow dryRun')
    check(file.read_text() == good, 'dryRun preserves disk bytes')
    response = sc(sync())
    check(response.get('ok') and response['summary']['applied'] == 1, 'valid Flow applied')
    check(sc(sync())['summary']['checked'] == 0, 'unchanged applied source omitted')
    # The actual compiler and the actual public dispatcher, on exactly the same bytes.
    file.write_text(bad)
    direct = call('code-check', {'project': project, 'name': 'SourceSyncExample', 'code': bad})
    response = sc(sync(paths=[path], dryRun=True))
    inner = response['results'][0]['response']
    check(inner['result'] == direct['result'], 'syntax response identical to code-check, including hints and guides')
    check(inner['result'].get('isError') and sc(inner).get('error', {}).get('code'), 'syntax refused with original code')
    response = sc(sync(paths=[path]))
    check(not response['ok'] and not response['results'][0]['diskApplied'], 'invalid source not applied')
    check(file.read_text() == bad, 'refused disk content retained for repair')
    runtime = call('code-run', {'project': project, 'name': 'SourceSyncExample'})
    runtime_reads_invalid = bool(runtime.get('result', {}).get('isError'))
    # Restore before exercising unrelated path handling.
    file.write_text(good)
    check(sc(sync(paths=[path])).get('ok'), 'repaired source applied')
    unsupported = sc(sync(paths=['_c8oProject/sequences/Generated.yaml']))['results'][0]
    error = sc(unsupported['response'])['error']
    check(error['code'] == 'SOURCE_TYPE_UNSUPPORTED' and error['details']['accepted'], 'unsupported path lists accepted types')
    traversal = sc(sync(paths=['../outside.flow.js']))['results'][0]
    check(sc(traversal['response'])['error']['code'] == 'SOURCE_PATH_REFUSED', 'traversal refused')
    # A deletion is deliberately signalled; it is never translated to a DBO removal.
    from subprocess import run as command
    command(['gio', 'trash', '--', str(file)], check=True)
    check(not file.exists(), 'test source deletion uses trash')
    deleted = sc(sync())
    check(any(sc(e['response']).get('error', {}).get('code') == 'SOURCE_FILE_DELETED' for e in deleted['results']),
          'default scan reports deleted source')
    file.write_text(good)
    # Model writes use the existing entity model check/set, including their diagnostics.
    model_path = '_flow/data/model.yaml'
    model_file = root / model_path
    model_file.parent.mkdir(parents=True, exist_ok=True)
    model_file.write_text('version: 2\nentities: {}\n')
    check(sc(sync(paths=[model_path], dryRun=True)).get('ok'), 'entity model dryRun through existing validator')
    check(sc(sync(paths=[model_path])).get('ok'), 'entity model application through existing writer')
    css_path = '_flow/frontbuilder/svelte/model/' + project + '/src/app.flow.css'
    css_file = root / css_path
    css_file.parent.mkdir(parents=True, exist_ok=True)
    css_file.write_text('body { color: #123; }\n')
    check(sc(sync(paths=[css_path], dryRun=True)).get('ok'), 'theme CSS uses canonical source checker')
    check(sc(sync(paths=[css_path])).get('ok'), 'theme CSS uses canonical source writer')
    schema = sc(sync(paths=['_flow/schemas/output.schema.json']))['results'][0]
    check(sc(schema['response'])['error']['code'] == 'SOURCE_TYPE_UNSUPPORTED',
          'schema files explicitly refused: no equivalent code validator in this kit')
    return {'ok': True, 'checks': checks, 'runtime_reads_invalid_disk': runtime_reads_invalid,
            'syntax_code': sc(inner)['error']['code']}
