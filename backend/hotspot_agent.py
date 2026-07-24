import os
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import APIRouter, Query
from dotenv import load_dotenv

load_dotenv()
router = APIRouter(tags=["Hotspots & Analytics"])

def get_db_connection():
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "127.0.0.1"),
        port=os.environ.get("DB_PORT", "5555"),
        dbname=os.environ.get("DB_NAME", "datathon_db"),
        user=os.environ.get("DB_USER", "datathon_user"),
        password=os.environ.get("DB_PASSWORD", "datathon_password")
    )

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

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    query = """
        SELECT latitude, longitude, crime_group, district_name, unit_name, fir_year, place_of_offence
        FROM fir_raw
        WHERE latitude IS NOT NULL 
          AND longitude IS NOT NULL
          AND latitude BETWEEN 11.0 AND 19.0
          AND longitude BETWEEN 74.0 AND 79.0
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

    cur.execute(query, params)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    # Format as lightweight GeoJSON FeatureCollection
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
    Returns available crime groups and districts for dropdown filtering.
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT DISTINCT crime_group FROM fir_raw WHERE crime_group IS NOT NULL ORDER BY crime_group LIMIT 30")
    crime_groups = [r["crime_group"] for r in cur.fetchall()]

    cur.execute("SELECT DISTINCT district_name FROM fir_raw WHERE district_name IS NOT NULL ORDER BY district_name LIMIT 40")
    districts = [r["district_name"] for r in cur.fetchall()]

    cur.close()
    conn.close()
    return {"crime_groups": crime_groups, "districts": districts}
