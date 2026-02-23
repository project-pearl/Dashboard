#!/usr/bin/env python3
"""
PIN Archive Query API — runs on VPS alongside cron pipeline.
Lightweight Flask endpoint that DuckDB-queries Parquet on R2.

pip install flask duckdb --break-system-packages

Usage:
    python archive_api.py                    # Runs on port 8099

Endpoints:
    GET /history?station=USGS-01589440&state=md&param=Dissolved+oxygen+(DO)
    GET /exceedances?state=md&year=2024
    GET /health

Environment:
    R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET=pin-archive
    USE_LOCAL_ARCHIVE=true    (skip R2, read local Parquet files)
    ARCHIVE_DIR=archive       (local Parquet directory)
"""

import os
import duckdb
from flask import Flask, request, jsonify

app = Flask(__name__)

R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY = os.environ.get("R2_ACCESS_KEY", "")
R2_SECRET_KEY = os.environ.get("R2_SECRET_KEY", "")
R2_BUCKET = os.environ.get("R2_BUCKET", "pin-archive")
USE_LOCAL = os.environ.get("USE_LOCAL_ARCHIVE", "false") == "true"
LOCAL_DIR = os.environ.get("ARCHIVE_DIR", "archive")


def get_conn():
    conn = duckdb.connect()
    if not USE_LOCAL:
        conn.execute(f"""
            SET s3_endpoint = '{R2_ACCOUNT_ID}.r2.cloudflarestorage.com';
            SET s3_access_key_id = '{R2_ACCESS_KEY}';
            SET s3_secret_access_key = '{R2_SECRET_KEY}';
            SET s3_region = 'auto';
            SET s3_url_style = 'path';
        """)
    return conn


def parquet_path(source, state, year=None):
    if USE_LOCAL:
        base = f"{LOCAL_DIR}/{source}/{state.lower()}"
    else:
        base = f"s3://{R2_BUCKET}/{source}/{state.lower()}"
    if year:
        return f"{base}/{year}.parquet"
    return f"{base}/*.parquet"


@app.route("/history")
def history():
    station = request.args.get("station")
    state = request.args.get("state")
    param = request.args.get("param")
    year = request.args.get("year", type=int)
    limit = request.args.get("limit", 200, type=int)
    source = request.args.get("source", "wqp")

    if not station or not state:
        return jsonify({"error": "station and state required"}), 400

    conn = get_conn()
    path = parquet_path(source, state, year)

    conditions = ["stationId = ?"]
    params = [station]
    if param:
        conditions.append("parameter = ?")
        params.append(param)
    params.append(min(limit, 1000))

    sql = f"""
        SELECT stationId, date, parameter, value, unit
        FROM read_parquet('{path}')
        WHERE {" AND ".join(conditions)}
        ORDER BY date DESC
        LIMIT ?
    """

    try:
        rows = conn.execute(sql, params).fetchall()
        cols = ["stationId", "date", "parameter", "value", "unit"]
        data = [dict(zip(cols, row)) for row in rows]
        return jsonify({"count": len(data), "data": data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/exceedances")
def exceedances():
    state = request.args.get("state")
    year = request.args.get("year", type=int)
    limit = request.args.get("limit", 500, type=int)

    if not state:
        return jsonify({"error": "state required"}), 400

    conn = get_conn()
    path = parquet_path("wqp", state, year)

    sql = f"""
        SELECT stationId, date, parameter, value, unit
        FROM read_parquet('{path}')
        WHERE (
            (parameter = 'Dissolved oxygen (DO)' AND value < 5.0) OR
            (parameter = 'Phosphorus' AND value > 0.1) OR
            (parameter IN ('Total Nitrogen, mixed forms', 'Nitrogen')
                AND value > 3.0) OR
            (parameter = 'Escherichia coli' AND value > 410.0) OR
            (parameter = 'Total suspended solids' AND value > 25.0)
        )
        ORDER BY date DESC
        LIMIT ?
    """

    try:
        rows = conn.execute(sql, [min(limit, 1000)]).fetchall()
        cols = ["stationId", "date", "parameter", "value", "unit"]
        data = [dict(zip(cols, row)) for row in rows]
        return jsonify({"count": len(data), "data": data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/health")
def health():
    return jsonify({"status": "ok", "storage": "local" if USE_LOCAL else "r2"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8099)
