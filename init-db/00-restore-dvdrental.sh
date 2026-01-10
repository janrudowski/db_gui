#!/bin/bash
set -e

pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" /db-dumps/dvdrental.tar || true
