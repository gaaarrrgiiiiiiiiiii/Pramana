import os
from functools import lru_cache
from psycopg2.extras import RealDictCursor
from fastapi import APIRouter, Query
from dotenv import load_dotenv
from db import get_db_cursor

load_dotenv()
router = APIRouter(tags=["Hotspots & Analytics"])

# In-memory filter cache
_FILTER_CACHE = None

@router.get("/api/hotspots")
def get_crime_hotspots(
    crime_group: str | None = Query(None),
    year: int | None = Query(None),
    district: str | None = Query(None),
    limit: int = 500
):
    """
    Fetches latitude/longitude coordinate clusters for crime hotspot visualization.
    Only returns valid non-null coordinates. Checks fir_raw first, falls back to cases table.
    """
    if hasattr(limit, "default"):
        limit = limit.default or 500
    if hasattr(crime_group, "default"):
        crime_group = crime_group.default
    if hasattr(year, "default"):
        year = year.default
    if hasattr(district, "default"):
        district = district.default

    # 1. Try querying fir_raw table first
    query_fir = """
        SELECT 
            CASE 
                WHEN latitude BETWEEN 74.0 AND 79.0 AND longitude BETWEEN 11.0 AND 19.0 THEN longitude
                ELSE latitude
            END as latitude,
            CASE 
                WHEN latitude BETWEEN 74.0 AND 79.0 AND longitude BETWEEN 11.0 AND 19.0 THEN latitude
                ELSE longitude
            END as longitude,
            crime_group, district_name, unit_name, fir_year, place_of_offence
        FROM fir_raw
        WHERE latitude IS NOT NULL 
          AND longitude IS NOT NULL
          AND ((latitude BETWEEN 11.0 AND 19.0 AND longitude BETWEEN 74.0 AND 79.0)
            OR (latitude BETWEEN 74.0 AND 79.0 AND longitude BETWEEN 11.0 AND 19.0))
    """
    params_fir = []
    if crime_group and crime_group != "All":
        query_fir += " AND crime_group ILIKE %s"
        params_fir.append(f"%{crime_group}%")
    if year and str(year) != "All":
        try:
            query_fir += " AND fir_year = %s"
            params_fir.append(int(year))
        except (ValueError, TypeError):
            pass
    if district and district != "All":
        query_fir += " AND district_name ILIKE %s"
        params_fir.append(f"%{district}%")
    query_fir += " LIMIT %s"
    params_fir.append(limit)

    rows = []
    with get_db_cursor(cursor_factory=RealDictCursor) as cur:
        try:
            cur.execute(query_fir, params_fir)
            rows = cur.fetchall()
        except Exception:
            rows = []

    # 2. If fir_raw is empty, query cases + locations tables
    if not rows:
        query_cases = """
            SELECT 
                l.latitude, l.longitude,
                o.name as crime_group,
                s.district as district_name,
                s.name as unit_name,
                EXTRACT(YEAR FROM c.date_filed)::int as fir_year,
                l.address as place_of_offence
            FROM cases c
            JOIN locations l ON c.location_id = l.id
            JOIN stations s ON c.station_id = s.id
            JOIN offense_types o ON c.offense_type_id = o.id
            WHERE l.latitude IS NOT NULL AND l.longitude IS NOT NULL
              AND l.latitude BETWEEN 11.0 AND 19.0
              AND l.longitude BETWEEN 74.0 AND 79.0
        """
        params_cases = []
        if crime_group and crime_group != "All":
            query_cases += " AND o.name ILIKE %s"
            params_cases.append(f"%{crime_group}%")
        if year and str(year) != "All":
            try:
                query_cases += " AND EXTRACT(YEAR FROM c.date_filed) = %s"
                params_cases.append(int(year))
            except (ValueError, TypeError):
                pass
        if district and district != "All":
            query_cases += " AND s.district ILIKE %s"
            params_cases.append(f"%{district}%")
        query_cases += " LIMIT %s"
        params_cases.append(limit)

        with get_db_cursor(cursor_factory=RealDictCursor) as cur:
            try:
                cur.execute(query_cases, params_cases)
                rows = cur.fetchall()
            except Exception:
                rows = []

    features = []
    for r in rows:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(r["longitude"]), float(r["latitude"])]
            },
            "properties": {
                "crime_group": r["crime_group"] or "Unclassified",
                "district": r["district_name"] or "Karnataka",
                "unit": r["unit_name"] or "Police Station",
                "year": r["fir_year"] or 2024,
                "place": r["place_of_offence"] or "Unknown"
            }
        })

    return {
        "type": "FeatureCollection",
        "count": len(features),
        "features": features
    }

@router.get("/api/hotspots/filters")
def get_hotspot_filters():
    """
    Returns available crime groups and districts for dropdown filtering (cached in memory).
    """
    global _FILTER_CACHE
    if _FILTER_CACHE:
        return _FILTER_CACHE

    crime_groups = []
    districts = []

    with get_db_cursor(cursor_factory=RealDictCursor) as cur:
        # Try fir_raw first
        try:
            cur.execute("SELECT DISTINCT crime_group FROM fir_raw WHERE crime_group IS NOT NULL ORDER BY crime_group LIMIT 30")
            crime_groups = [r["crime_group"] for r in cur.fetchall()]

            cur.execute("SELECT DISTINCT district_name FROM fir_raw WHERE district_name IS NOT NULL ORDER BY district_name LIMIT 40")
            districts = [r["district_name"] for r in cur.fetchall()]
        except Exception:
            pass

        # Fallback to offense_types & stations if empty
        if not crime_groups:
            try:
                cur.execute("SELECT DISTINCT name FROM offense_types WHERE name IS NOT NULL ORDER BY name")
                crime_groups = [r["name"] for r in cur.fetchall()]
            except Exception:
                pass

        if not districts:
            try:
                cur.execute("SELECT DISTINCT district FROM stations WHERE district IS NOT NULL ORDER BY district")
                districts = [r["district"] for r in cur.fetchall()]
            except Exception:
                pass

    _FILTER_CACHE = {"crime_groups": crime_groups, "districts": districts}
    return _FILTER_CACHE
