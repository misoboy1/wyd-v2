#!/bin/sh
# DB 백업: /backups/wyd_YYYYMMDD_HHMM.sql.gz, 7일 지난 파일 삭제
set -e
f="/backups/wyd_$(date +%Y%m%d_%H%M).sql.gz"
pg_dump -h db -U wyd -d wyd --no-owner | gzip > "$f"
find /backups -name 'wyd_*.sql.gz' -mtime +7 -delete
echo "backup ok: $f"
