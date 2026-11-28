#!/usr/bin/env bash
#
# Publish the signed release APK to the canonical Supabase Storage object.
#
# Usage:
#   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
#     scripts/publish-apk.sh android/app/build/outputs/apk/release/app-release.apk \
#     [version_name] [version_code]
#
# When the version arguments are omitted they are read from
# android/app/build.gradle, which is the same value Gradle stamped into the APK.
#
# Guarantees:
#   - nothing is uploaded unless the file is a real APK (ZIP structure with
#     AndroidManifest.xml and classes.dex) and within the 100 MiB ceiling;
#   - the previous canonical object is never deleted first — the upload replaces
#     it in a single request, so a failed publish leaves the old APK serving;
#   - the object is downloaded again and its SHA-256 compared before the release
#     metadata is written, so a truncated upload can never be advertised;
#   - re-running with the same APK is idempotent: the same object path and the
#     same single metadata row are overwritten.
#
# Secrets are read from the environment only. They are never printed, written to
# a file, or included in an artifact.

set -euo pipefail

readonly BUCKET="porokh-apk"
readonly OBJECT_PATH="releases/latest/Porokh.apk"
readonly MAX_BYTES=$((100 * 1024 * 1024))
readonly GRADLE_FILE="android/app/build.gradle"

fail() {
  printf '::error::%s\n' "$*" >&2
  exit 1
}

note() {
  printf '[publish-apk] %s\n' "$*"
}

APK_PATH="${1:-}"
VERSION_NAME="${2:-}"
VERSION_CODE="${3:-}"

[ -n "$APK_PATH" ] || fail "usage: publish-apk.sh <apk-path> [version-name] [version-code]"
[ -f "$APK_PATH" ] || fail "APK not found at $APK_PATH"

[ -n "${SUPABASE_URL:-}" ] || fail \
  "SUPABASE_URL is missing. Add it as a GitHub Actions repository secret named SUPABASE_URL (the project URL, for example https://<ref>.supabase.co)."
[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] || fail \
  "SUPABASE_SERVICE_ROLE_KEY is missing. Add the service-role key as a GitHub Actions repository secret named SUPABASE_SERVICE_ROLE_KEY. It is server-side only and must never be committed or printed."

BASE_URL="${SUPABASE_URL%/}"

command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v python3 >/dev/null 2>&1 || fail "python3 is required"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is required"

# ---------------------------------------------------------------------------
# 1. Validate the artifact
# ---------------------------------------------------------------------------
size=$(wc -c < "$APK_PATH" | tr -d ' ')
[ "$size" -gt 0 ] || fail "The APK at $APK_PATH is empty"
[ "$size" -le "$MAX_BYTES" ] || fail "The APK is larger than the 100 MiB Storage limit (${size} bytes)"

python3 - "$APK_PATH" <<'PY' || fail "The file is not a valid Android APK"
import sys
import zipfile

path = sys.argv[1]
try:
    with open(path, "rb") as handle:
        if handle.read(2) != b"PK":
            raise SystemExit(1)
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
except Exception:
    raise SystemExit(1)

missing = [entry for entry in ("AndroidManifest.xml", "classes.dex") if entry not in names]
if missing:
    print("missing entries: " + ", ".join(missing), file=sys.stderr)
    raise SystemExit(1)
PY
note "APK structure verified ($size bytes)"

if [ -z "$VERSION_NAME" ]; then
  VERSION_NAME=$(sed -n 's/.*versionName "\([^"]*\)".*/\1/p' "$GRADLE_FILE" | head -1)
fi
if [ -z "$VERSION_CODE" ]; then
  VERSION_CODE=$(sed -n 's/.*versionCode \([0-9][0-9]*\).*/\1/p' "$GRADLE_FILE" | head -1)
fi

[ -n "$VERSION_NAME" ] || fail "Could not determine the APK version name"
case "$VERSION_CODE" in
  ''|*[!0-9]*) fail "Could not determine a numeric APK version code" ;;
esac

note "version ${VERSION_NAME} (${VERSION_CODE})"

checksum=$(sha256sum "$APK_PATH" | cut -d' ' -f1)
[ "${#checksum}" -eq 64 ] || fail "Could not calculate the APK SHA-256"
note "sha256 ${checksum}"

object_url="${BASE_URL}/storage/v1/object/${BUCKET}/${OBJECT_PATH}"
public_url="${BASE_URL}/storage/v1/object/public/${BUCKET}/${OBJECT_PATH}"
rest_url="${BASE_URL}/rest/v1/apk_release"

auth_headers=(
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}"
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
)

work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT
downloaded="${work_dir}/downloaded.apk"

# ---------------------------------------------------------------------------
# 2. Upload (or replace) the canonical object
# ---------------------------------------------------------------------------
note "uploading to ${BUCKET}/${OBJECT_PATH}"
if ! curl -sS --fail-with-body \
  -X POST "$object_url" \
  "${auth_headers[@]}" \
  -H "x-upsert: true" \
  -H "cache-control: no-cache" \
  -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary "@${APK_PATH}" \
  -o "${work_dir}/upload.json"; then
  fail "Upload to Supabase Storage failed. The previously published APK is unchanged."
fi

# ---------------------------------------------------------------------------
# 3. Download the stored object and prove it is the file that was uploaded
# ---------------------------------------------------------------------------
verified=0
for attempt in 1 2 3 4 5; do
  if curl -fsSL --retry 2 "$public_url" -o "$downloaded"; then
    stored_checksum=$(sha256sum "$downloaded" | cut -d' ' -f1)
    if [ "$stored_checksum" = "$checksum" ]; then
      verified=1
      break
    fi
    note "downloaded checksum does not match yet (attempt ${attempt})"
  else
    note "public download not available yet (attempt ${attempt})"
  fi
  sleep 2
done

[ "$verified" -eq 1 ] || fail "The uploaded APK could not be verified by downloading it from Storage"
note "stored object verified: identical bytes at ${public_url}"

# ---------------------------------------------------------------------------
# 4. Write the release metadata (single row, id = 1)
# ---------------------------------------------------------------------------
released_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
filename=$(basename "$APK_PATH")

payload=$(VERSION_NAME="$VERSION_NAME" VERSION_CODE="$VERSION_CODE" FILENAME="$filename" \
  FILE_SIZE="$size" SHA256="$checksum" RELEASED_AT="$released_at" python3 - <<'PY'
import json
import os

print(json.dumps({
    "id": 1,
    "version_name": os.environ["VERSION_NAME"],
    "version_code": int(os.environ["VERSION_CODE"]),
    "original_filename": os.environ["FILENAME"],
    "file_size": int(os.environ["FILE_SIZE"]),
    "sha256": os.environ["SHA256"],
    "released_at": os.environ["RELEASED_AT"],
    "updated_at": os.environ["RELEASED_AT"],
    "published_by": None,
}))
PY
)

written=0
for attempt in 1 2 3; do
  if curl -sS --fail-with-body \
    -X POST "${rest_url}?on_conflict=id" \
    "${auth_headers[@]}" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates,return=minimal" \
    --data-binary "$payload" \
    -o "${work_dir}/metadata.json"; then
    written=1
    break
  fi
  note "release metadata write failed (attempt ${attempt})"
  sleep 2
done

[ "$written" -eq 1 ] || fail "The APK is stored at the canonical path but the release metadata could not be written. Re-run this job to finish publishing."

# ---------------------------------------------------------------------------
# 5. Read the row back and confirm it describes the uploaded file
# ---------------------------------------------------------------------------
rows=$(curl -sS --fail-with-body \
  "${rest_url}?id=eq.1&select=version_name,version_code,file_size,sha256" \
  "${auth_headers[@]}") || fail "Could not read back the release metadata"

VERSION_NAME="$VERSION_NAME" VERSION_CODE="$VERSION_CODE" FILE_SIZE="$size" SHA256="$checksum" \
  python3 - "$rows" <<'PY' || fail "The stored release metadata does not match the uploaded APK"
import json
import os
import sys

rows = json.loads(sys.argv[1])
if not rows:
    raise SystemExit("no apk_release row")

row = rows[0]
expected = {
    "version_name": os.environ["VERSION_NAME"],
    "version_code": int(os.environ["VERSION_CODE"]),
    "file_size": int(os.environ["FILE_SIZE"]),
    "sha256": os.environ["SHA256"],
}
actual = {key: row.get(key) for key in expected}
if actual != expected:
    print(f"expected {expected}, found {actual}", file=sys.stderr)
    raise SystemExit(1)
PY

note "release metadata verified"

# ---------------------------------------------------------------------------
# 6. Report
# ---------------------------------------------------------------------------
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### APK published"
    echo ""
    echo "| | |"
    echo "|---|---|"
    echo "| Version | \`${VERSION_NAME}\` (\`${VERSION_CODE}\`) |"
    echo "| File | \`${filename}\` |"
    echo "| Size | ${size} bytes |"
    echo "| SHA-256 | \`${checksum}\` |"
    echo "| Storage object | \`${BUCKET}/${OBJECT_PATH}\` |"
    echo "| Public URL | ${public_url} |"
    echo ""
    echo "The stored object was downloaded again and its SHA-256 matched this build."
  } >> "$GITHUB_STEP_SUMMARY"
fi

note "published ${VERSION_NAME} (${VERSION_CODE}) to ${public_url}"
