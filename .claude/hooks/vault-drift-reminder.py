#!/usr/bin/env python3
"""PostToolUse hook: reminds to run /ingest when a file under docs/ is written or edited."""
import json
import os
import sys

try:
    data = json.load(sys.stdin)
    tool_input = data.get("tool_input", {})
    # Write tool uses file_path; Edit/MultiEdit use file_path too
    file_path = tool_input.get("file_path", "")
except Exception:
    sys.exit(0)

if "/docs/" in file_path:
    basename = os.path.basename(file_path)
    msg = (
        f"Knowledge vault reminder: {basename} was written under docs/. "
        f"Run /ingest {file_path} to sync it into the vault "
        "(copy to raw-sources/, update wiki page, append log, bump index updated date, run lint)."
    )
    print(json.dumps({"systemMessage": msg}))

sys.exit(0)
