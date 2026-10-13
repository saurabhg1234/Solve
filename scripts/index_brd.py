"""Create a traceable, read-only BRD index. Requires the document environment."""
from pathlib import Path
from hashlib import sha256
import json
import re
from docx import Document

repo = Path(__file__).resolve().parents[1]
source = repo / 'AI_Solutioning_Agent_BRD_v1.0/01_BRD/AI_Solutioning_Agent_BRD_v1.0.docx'
document = Document(source)
tables = [[[c.text.strip() for c in row.cells] for row in table.rows] for table in document.tables]
steps = {f'W{i}': [] for i in range(1, 9)}
steps['S1'] = []
requirements = []
for number, table in enumerate(tables):
    headers = table[0]
    if headers[:2] == ['#', 'From the brief']:
        requirements.extend(dict(zip(headers, row)) for row in table[1:])
    if headers[0] == '#' and headers[1] in ['Agent', 'Check', 'Step']:
        for row in table[1:]:
            match = re.match(r'^(W[1-8]|S1)-', row[0])
            if match:
                entry = {'id': row[0], 'title': row[1], 'instruction': row[2], 'output': row[3] if len(row)>3 else '', 'guard': row[4] if len(row)>4 else row[3] if len(row)>3 else '', 'source_table': number}
                steps[match[1]].append(entry)
assert len(requirements) == 272
assert [int(r['#']) for r in requirements] == list(range(1, 273))
assert all(steps.values())
index = {
    'source': str(source.relative_to(repo)), 'source_sha256': sha256(source.read_bytes()).hexdigest(),
    'requirements': requirements, 'steps': steps,
    'house_rules': [dict(zip(tables[60][0], row)) for row in tables[60][1:]],
    'human_gates': [dict(zip(tables[64][0], row)) for row in tables[64][1:]],
    'qc_profiles': [dict(zip(tables[44][0], row)) for row in tables[44][1:]],
    'configuration': [dict(zip(tables[62][0], row)) for row in tables[62][1:]],
    'pending_inputs': [dict(zip(tables[75][0], row)) for row in tables[75][1:]],
    'template_mapping': [dict(zip(tables[77][0], row)) for row in tables[77][1:]],
}
out = repo / 'data/brd-index.json'
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(index, indent=2, ensure_ascii=False)+'\n')
print(f'Indexed {len(requirements)} requirements and {sum(map(len,steps.values()))} workflow/shared steps without changing the BRD.')
