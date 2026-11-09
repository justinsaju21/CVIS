import os, sys, re
sys.stdout.reconfigure(encoding='utf-8')

excluded_dirs = {'node_modules', '.next', 'venv', '.venv', '.git', '.gemini', 'scratch', '__pycache__', 'dist', 'build'}

def get_files(base_dir, exts):
    res = []
    for root, dirs, files in os.walk(base_dir):
        dirs[:] = [d for d in dirs if d not in excluded_dirs]
        for f in files:
            if any(f.endswith(ext) for ext in exts):
                res.append(os.path.join(root, f))
    return res

frontend_files = get_files('frontend', ('.ts', '.tsx'))
backend_files = get_files('backend', ('.py',))

print(f"Auditing {len(frontend_files)} frontend files and {len(backend_files)} backend files...")

keywords = [
    'mock', 'fake', 'dummy', 'hardcoded', 'default to', 'fallback',
    '34', '11 mV', '794 V', '4.16', '3 tips active', 'Ionity Hub', '0.208 Cd',
    'Math.random'
]

for filepath in frontend_files + backend_files:
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    found_any = False
    for kw in keywords:
        # Check if keyword exists
        matches = [m.start() for m in re.finditer(re.escape(kw), content, re.IGNORECASE)]
        if matches:
            # If kw is 34, only care if it relates to tire, PSI, or telemetry
            if kw == '34':
                matches = [m for m in matches if 'tire' in content[max(0, m-50):min(len(content), m+50)].lower() or 'psi' in content[max(0, m-50):min(len(content), m+50)].lower()]
                if not matches:
                    continue
            print(f"[{filepath}] Keyword '{kw}': {len(matches)} match(es)")
            for idx in matches[:3]:
                snippet = content[max(0, idx-60):min(len(content), idx+80)].replace('\n', ' ')
                print(f"   -> {snippet}")
