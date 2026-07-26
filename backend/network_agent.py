import os
import re
import json
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from db import get_db_connection, get_db_cursor

load_dotenv()

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

client = genai.Client()

class TargetExtraction(BaseModel):
    target: str = Field(description="The core entity (person, crime group, or station) to search for in the network.")

RANK_SUFFIX_REGEX = re.compile(r"\s*\((PI|SI|PSI|HC|ASI|WHC|WPC|WPSI|DGP|IGP|SP|DSP)\)\s*", re.IGNORECASE)

def clean_entity_name(name: str) -> str:
    cleaned = RANK_SUFFIX_REGEX.sub("", name).strip()
    # Normalize dots in names like CHANDRAKALA.M.B -> CHANDRAKALA M B
    cleaned = re.sub(r"\.+", " ", cleaned).strip()
    return cleaned

def build_network_graph(user_query: str, limit: int = 30) -> dict:
    """
    Extracts the target from the user's query and builds a 2-hop criminal / investigative network graph.
    Searches both normalized `cases` and 1.6M-row `fir_raw` table with clean name matching.
    """
    target = ""
    try:
        extraction_prompt = f"Extract the main entity (person name, station name, gang name, or crime group) from this query: '{user_query}'"
        response = client.models.generate_content(
            model='models/gemini-2.5-flash',
            contents=extraction_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=TargetExtraction,
                temperature=0.0
            ),
        )
        target = json.loads(response.text).get("target", "").strip()
    except Exception as e:
        print(f"NetworkAgent LLM extraction error: {e}")
        target = user_query

    if not target:
        return {"nodes": [], "edges": [], "target": target, "target_type": "unknown", "summary": "Could not extract a search target from the query."}

    cleaned_target = clean_entity_name(target)

    nodes = {}
    edges_set = set()
    edges = []

    def add_node(node_id, label, type_):
        if node_id not in nodes:
            nodes[node_id] = {"id": node_id, "label": label, "type": type_}

    def add_edge(source, target_id, label):
        key = (source, target_id, label)
        if key not in edges_set:
            edges_set.add(key)
            edges.append({"source": source, "target": target_id, "label": label})

    seen_case_ids = set()
    seen_raw_kgids = set()

    def do_search(cur, search_term):
        # 1. Search normalized cases table
        cur.execute("""
            SELECT c.id as case_id, c.fir_number, c.io_name,
                   s.name as station_name, s.id as station_id,
                   o.crime_group
            FROM cases c
            JOIN stations s ON c.station_id = s.id
            JOIN offense_types o ON c.offense_type_id = o.id
            WHERE c.io_name ILIKE %s OR s.name ILIKE %s OR o.crime_group ILIKE %s
            LIMIT %s
        """, (f"%{search_term}%", f"%{search_term}%", f"%{search_term}%", limit))

        for row in cur.fetchall():
            if row['case_id'] in seen_case_ids:
                continue
            seen_case_ids.add(row['case_id'])

            case_node_id = f"case_{row['case_id']}"
            station_node_id = f"station_{row['station_id']}"
            io_node_id = f"io_{row['io_name']}" if row['io_name'] else "io_unknown"
            group_node_id = f"group_{row['crime_group']}"

            add_node(case_node_id, f"FIR: {row['fir_number']}", "case")
            add_node(station_node_id, row['station_name'], "station")
            add_node(group_node_id, row['crime_group'], "crime_group")
            if row['io_name']:
                add_node(io_node_id, row['io_name'], "investigator")

            add_edge(case_node_id, station_node_id, "filed_at")
            add_edge(case_node_id, group_node_id, "classified_as")
            if row['io_name']:
                add_edge(io_node_id, case_node_id, "investigates")

        # 2. Search fir_raw (1.6M records) for io_name, unit_name, crime_group, place
        cur.execute("""
            SELECT DISTINCT io_name, unit_name, crime_group,
                   fir_year, kgid, district_name
            FROM fir_raw
            WHERE io_name ILIKE %s
               OR unit_name ILIKE %s
               OR crime_group ILIKE %s
               OR place_of_offence ILIKE %s
            LIMIT %s
        """, (f"%{search_term}%", f"%{search_term}%", f"%{search_term}%", f"%{search_term}%", limit))

        for row in cur.fetchall():
            kgid = row.get('kgid') or f"raw_{row['unit_name']}_{row['fir_year']}"
            if kgid in seen_raw_kgids:
                continue
            seen_raw_kgids.add(kgid)

            case_node_id = f"raw_{kgid}"
            unit_node_id = f"unit_{row['unit_name']}"
            group_node_id = f"group_{row['crime_group']}"

            add_node(case_node_id, f"FIR: {kgid}", "case")
            add_node(unit_node_id, row['unit_name'] or "Unknown Unit", "station")
            add_node(group_node_id, row['crime_group'] or "Unknown", "crime_group")

            if row['io_name']:
                io_node_id = f"io_{row['io_name']}"
                add_node(io_node_id, row['io_name'], "investigator")
                add_edge(io_node_id, case_node_id, "investigates")

            add_edge(case_node_id, unit_node_id, "filed_at")
            add_edge(case_node_id, group_node_id, "classified_as")

    try:
        with get_db_cursor(cursor_factory=RealDictCursor) as cur:
            # 1. Search with cleaned target first
            do_search(cur, cleaned_target)

            # 2. If cleaned_target is different from original, search original target
            if cleaned_target != target and not seen_case_ids and not seen_raw_kgids:
                do_search(cur, target)

            # 3. Fallback: if still no results, try matching words longer than 3 chars
            if not seen_case_ids and not seen_raw_kgids:
                sub_tokens = [t for t in cleaned_target.split() if len(t) > 3]
                for token in sub_tokens:
                    do_search(cur, token)

    except Exception as e:
        print(f"Error building network graph: {e}")
        return {
            "nodes": [],
            "edges": [],
            "target": target,
            "target_type": "unknown",
            "summary": f"Database error while building graph: {str(e)}"
        }

    # Determine target_type for header display
    investigator_nodes = [n for n in nodes.values() if n['type'] == 'investigator']
    is_investigator = any(cleaned_target.lower() in n['label'].lower() for n in investigator_nodes)
    target_type = "investigator" if is_investigator else "general"

    summary = (
        f"Found {len(nodes)} entities connected to '{target}': "
        f"{len(investigator_nodes)} investigators, "
        f"{len([n for n in nodes.values() if n['type']=='station'])} stations, "
        f"{len([n for n in nodes.values() if n['type']=='case'])} cases, "
        f"{len([n for n in nodes.values() if n['type']=='crime_group'])} crime groups."
    )

    return {
        "nodes": list(nodes.values()),
        "edges": edges,
        "target": target,
        "target_type": target_type,
        "summary": summary
    }

if __name__ == "__main__":
    res = build_network_graph("CHANDRAKALA M B")
    print(json.dumps(res, indent=2))
