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
    Only returns valid non-null coordinates.
    """
    if hasattr(limit, "default"):
        limit = limit.default or 500
    if hasattr(crime_group, "default"):
        crime_group = crime_group.default
    if hasattr(year, "default"):
        year = year.default
    if hasattr(district, "default"):
        district = district.default

    query = """
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
    params = []

    if crime_group and crime_group != "All":
        query += " AND crime_group ILIKE %s"
        params.append(f"%{crime_group}%")
    if year:
        query += " AND fir_year = %s"
        params.append(year)
    if district and district != "All":
        query += " AND district_name ILIKE %s"
        params.append(f"%{district}%")

    query += " LIMIT %s"
    params.append(limit)

    with get_db_cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(query, params)
        rows = cur.fetchall()

    features = []
    for r in rows:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(r["longitude"]), float(r["latitude"])]
            },
            "properties": {
                "crime_group": r["crime_group"],
                "district": r["district_name"],
                "unit": r["unit_name"],
                "year": r["fir_year"],
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

    with get_db_cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT DISTINCT crime_group FROM fir_raw WHERE crime_group IS NOT NULL ORDER BY crime_group LIMIT 30")
        crime_groups = [r["crime_group"] for r in cur.fetchall()]

        cur.execute("SELECT DISTINCT district_name FROM fir_raw WHERE district_name IS NOT NULL ORDER BY district_name LIMIT 40")
        districts = [r["district_name"] for r in cur.fetchall()]

    _FILTER_CACHE = {"crime_groups": crime_groups, "districts": districts}
    return _FILTER_CACHE
