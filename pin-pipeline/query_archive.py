#!/usr/bin/env python3
"""
Query PIN cold storage (local Parquet files).

Usage:
    python query_archive.py --station USGS-01589440 --state md --param "Dissolved oxygen (DO)"
    python query_archive.py --state md --year 2023 --param "Phosphorus"
    python query_archive.py --state md --exceedances-only
"""

import duckdb
import argparse
from pathlib import Path

ARCHIVE_DIR = "archive/wqp"

def query_station_history(station_id: str, parameter: str = None,
                          state: str = None, limit: int = 100):
    """Pull observation history for a specific station."""
    conn = duckdb.connect()

    if state:
        pattern = f"{ARCHIVE_DIR}/{state.lower()}/*.parquet"
    else:
        pattern = f"{ARCHIVE_DIR}/*/*.parquet"

    where_clauses = ["stationId = ?"]
    params = [station_id]

    if parameter:
        where_clauses.append("parameter = ?")
        params.append(parameter)

    where = " AND ".join(where_clauses)
    params.append(limit)

    sql = f"""
        SELECT stationId, date, parameter, value, unit
        FROM read_parquet('{pattern}')
        WHERE {where}
        ORDER BY date DESC
        LIMIT ?
    """

    result = conn.execute(sql, params).fetchdf()
    conn.close()
    return result


def query_state_year(state: str, year: int, parameter: str = None,
                     limit: int = 1000):
    """Pull observations for a state + year."""
    conn = duckdb.connect()
    parquet_file = f"{ARCHIVE_DIR}/{state.lower()}/{year}.parquet"

    if not Path(parquet_file).exists():
        print(f"No data: {parquet_file}")
        return None

    where = "1=1"
    params = []
    if parameter:
        where = "parameter = ?"
        params.append(parameter)
    params.append(limit)

    sql = f"""
        SELECT stationId, date, parameter, value, unit
        FROM read_parquet('{parquet_file}')
        WHERE {where}
        ORDER BY date DESC
        LIMIT ?
    """

    result = conn.execute(sql, params).fetchdf()
    conn.close()
    return result


def query_exceedances(state: str, year: int = None, parameter: str = None):
    """Find all threshold exceedances in the archive."""
    conn = duckdb.connect()

    if year:
        pattern = f"{ARCHIVE_DIR}/{state.lower()}/{year}.parquet"
    else:
        pattern = f"{ARCHIVE_DIR}/{state.lower()}/*.parquet"

    sql = f"""
        SELECT
            stationId, date, parameter, value, unit,
            CASE
                WHEN parameter = 'Dissolved oxygen (DO)' AND value < 5.0
                    THEN ROUND((5.0 - value) / 5.0 * 100, 1)
                WHEN parameter = 'Phosphorus' AND value > 0.1
                    THEN ROUND((value - 0.1) / 0.1 * 100, 1)
                WHEN parameter IN ('Total Nitrogen, mixed forms', 'Nitrogen')
                    AND value > 3.0
                    THEN ROUND((value - 3.0) / 3.0 * 100, 1)
                WHEN parameter = 'Escherichia coli' AND value > 410.0
                    THEN ROUND((value - 410.0) / 410.0 * 100, 1)
                WHEN parameter = 'Total suspended solids' AND value > 25.0
                    THEN ROUND((value - 25.0) / 25.0 * 100, 1)
                WHEN parameter = 'Turbidity' AND value > 50.0
                    THEN ROUND((value - 50.0) / 50.0 * 100, 1)
                ELSE NULL
            END AS pct_over_threshold
        FROM read_parquet('{pattern}')
        WHERE (
            (parameter = 'Dissolved oxygen (DO)' AND value < 5.0) OR
            (parameter = 'Phosphorus' AND value > 0.1) OR
            (parameter IN ('Total Nitrogen, mixed forms', 'Nitrogen')
                AND value > 3.0) OR
            (parameter = 'Escherichia coli' AND value > 410.0) OR
            (parameter = 'Total suspended solids' AND value > 25.0) OR
            (parameter = 'Turbidity' AND value > 50.0)
        )
        ORDER BY pct_over_threshold DESC
        LIMIT 500
    """

    result = conn.execute(sql).fetchdf()
    conn.close()
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--station", help="Station ID (e.g., USGS-01589440)")
    parser.add_argument("--state", help="State code (e.g., md)")
    parser.add_argument("--year", type=int, help="Year filter")
    parser.add_argument("--param", help="Parameter name filter")
    parser.add_argument("--exceedances-only", action="store_true")
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--format", choices=["table", "json"], default="table")
    args = parser.parse_args()

    if args.exceedances_only and args.state:
        df = query_exceedances(args.state, args.year, args.param)
    elif args.station:
        df = query_station_history(
            args.station, args.param, args.state, args.limit)
    elif args.state and args.year:
        df = query_state_year(args.state, args.year, args.param, args.limit)
    else:
        print("Provide --station, --state+--year, or --state+--exceedances-only")
        return

    if df is None or df.empty:
        print("No results.")
        return

    if args.format == "json":
        print(df.to_json(orient="records", indent=2))
    else:
        print(df.to_string(index=False))
    print(f"\n{len(df)} rows returned.")

if __name__ == "__main__":
    main()
