"""Produce matching self-hosted assets from the already built and checked package."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[3]
PACKAGE = ROOT / 'sdks/web/packages/web'
OUTPUT = ROOT / '.local/web-sdk-pack'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def package_assets():
    manifest = json.loads((PACKAGE / 'package.json').read_text())
    if manifest['name'] != 'localisync_sdk':
        raise ValueError('Unexpected package')
    version = manifest['version']
    files = {name: (PACKAGE / 'dist' / name).read_bytes()
             for name in ('localisync.js', 'worker.js')}
    for name in ('LICENSE', 'NOTICE'):
        files[name] = (PACKAGE / name).read_bytes()
    for path in sorted((PACKAGE / 'licenses').iterdir()):
        if path.is_symlink() or not path.is_file():
            raise ValueError('Unexpected license input')
        files['licenses/' + path.name] = path.read_bytes()
    files['README.txt'] = (f'Localisync Web SDK {version}\n\n'
        'Host localisync.js and worker.js on the application origin.\n'
        'Use the Localisync global and configure workerUrl with the matching module worker.\n'
        'Keep prepared bundled messages for offline startup. Call start() once; refresh() is explicit.\n'
        'Follow https://docs.localisync.com/sdks/web/html/ for integration.\n'
        'SDK code is MIT licensed. Dependency and Unicode notices are included.\n').encode()
    files['manifest.json'] = (json.dumps({'schema': 1, 'package': manifest['name'], 'version': version,
        'files': {name: digest(body) for name, body in sorted(files.items())}}, indent=2) + '\n').encode()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    archive = OUTPUT / f'localisync_sdk-{version}-script.zip'
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as target:
        for name, body in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            target.writestr(info, body)
    with zipfile.ZipFile(archive) as check:
        if set(check.namelist()) != set(files) or any(check.read(name) != body for name, body in files.items()):
            raise ValueError('Asset archive integrity failure')
    assets = [OUTPUT / f'localisync_sdk-{version}.tgz', OUTPUT / f'localisync_sdk_generator-{version}.tgz', archive]
    if any(not path.is_file() for path in assets):
        raise ValueError('Run the package acceptance tool first')
    (OUTPUT / 'SHA256SUMS').write_text(''.join(f'{digest(path.read_bytes())}  {path.name}\n' for path in assets))
    print(f'Checked version-matched script ZIP and hashes for {len(assets)} assets.')


if __name__ == '__main__':
    package_assets()
