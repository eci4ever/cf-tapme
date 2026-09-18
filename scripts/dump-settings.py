#!/usr/bin/env python3
"""Dump settings-related tables from remote and local D1 for comparison."""
import json, subprocess, sys

TABLES = [
    "organization",
    "employee",
    "work_site",
    "org_holiday",
    "leave_type",
    "platform_settings",
]
OUT = {}

for target in ("remote", "local"):
    OUT[target] = {}
    for table in TABLES:
        cmd = [
            "npx", "wrangler", "d1", "execute", "cf-tapme-db",
            "--" + target, "--json", "--command", f"SELECT * FROM {table};",
        ]
        raw = subprocess.run(cmd, capture_output=True, text=True).stdout
        i = raw.find("[")
        if i < 0:
            OUT[target][table] = f"PARSE_ERROR: {raw[:200]}"
            continue
        try:
            data = json.loads(raw[i: raw.rfind("]") + 1])
            OUT[target][table] = data[0]["results"]
        except Exception as e:
            OUT[target][table] = f"ERROR: {e}"

with open("/tmp/sync-dump.json", "w") as f:
    json.dump(OUT, f, indent=1, default=str)

# quick summary
for target in ("remote", "local"):
    print(f"== {target} ==")
    for table in TABLES:
        rows = OUT[target][table]
        n = len(rows) if isinstance(rows, list) else rows
        print(f"  {table}: {n if isinstance(n, int) else n} rows")
