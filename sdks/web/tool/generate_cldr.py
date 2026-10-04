"""Generate bounded cardinal/ordinal predicates from verified CLDR data. No network."""
from pathlib import Path
import json,re,hashlib
root=Path(__file__).resolve().parents[2]/'flutter/tool'
sources=json.loads((root/'cldr/sources.json').read_text())
for name,record in sources.items():
    if hashlib.sha256((root/'cldr'/f'{name}.json').read_bytes()).hexdigest()!=record['sha256']:
        raise ValueError('CLDR source integrity mismatch')
def predicate(rule):
    rule=rule.split('@')[0].strip()
    if not rule:return 'true'
    ors=[]
    for clause in rule.split(' or '):
        ands=[]
        for term in clause.split(' and '):
            m=re.fullmatch(r'([nivwftce])(?: % ([0-9]+))? (!=|=) ([0-9.,]+)',term.strip())
            if not m:raise ValueError('Unrecognized CLDR rule: '+term)
            operand,mod,op,values=m.groups()
            expr=f'o.{operand}' if not mod else f'(o.{operand} % {mod})'
            tests=[]
            for span in values.split(','):
                if '..' in span:
                    lo,hi=span.split('..');tests.append(f'({expr} >= {lo} && {expr} <= {hi})')
                else:tests.append(f'{expr} === {span}')
            check='('+' || '.join(tests)+')'
            # CLDR equality ranges match integers only (not fractional values between endpoints).
            if any('..' in span for span in values.split(',')):
                check=f'(Number.isInteger({expr}) && {check})'
            ands.append('!'+check if op=='!=' else check)
        ors.append('('+' && '.join(ands)+')')
    return ' || '.join(ors)
lines=['// Generated from verified Unicode CLDR 48.2.1; run tool/generate_cldr.py.', '// See licenses/Unicode-LICENSE.txt.', "import type { Operands } from './plural.js'", 'type Rule = (o: Operands) => string']
for name,suffix in [('plurals','cardinal'),('ordinals','ordinal')]:
    rules=json.loads((root/'cldr'/f'{name}.json').read_text())['supplemental']['plurals-type-'+suffix]
    unique={}
    for lang,categories in rules.items():
        body='\n'.join(f"if ({predicate(rule)}) return '{cat.removeprefix('pluralRule-count-')}';" for cat,rule in categories.items() if cat!='pluralRule-count-other')+"\nreturn 'other';"
        unique.setdefault(body,[]).append(lang)
    for idx,(body,langs) in enumerate(unique.items()):
        args='o: Operands' if 'o.' in body else ''
        lines.append(f'const {suffix}{idx}: Rule = ({args}) => {{\n{body}\n}}')
    lines.append(f'export const {suffix}Rules: Readonly<Record<string, Rule>> = {{')
    for idx,(body,langs) in enumerate(unique.items()):
        for lang in langs:lines.append(f"'{lang}': {suffix}{idx},")
    lines.append('}')
aliases=json.loads((root/'cldr/aliases.json').read_text())['supplemental']['metadata']['alias']['languageAlias']
lines.append('export const languageAliases: Readonly<Record<string, string>> = '+json.dumps({k:v['_replacement'].split()[0] for k,v in aliases.items()},sort_keys=True))
(Path(__file__).resolve().parents[1]/'packages/web/src/core/cldr.ts').write_text('\n'.join(lines)+'\n')

import subprocess
subprocess.run(["pnpm", "exec", "prettier", "--write", "src/core/cldr.ts"], cwd=Path(__file__).resolve().parents[1]/"packages/web", check=True)
