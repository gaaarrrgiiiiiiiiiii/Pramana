-- Datathon Investigative Co-Pilot: Core Agent Queries

-- 1. NETWORK AGENT: Recursive CTE for 2-hop criminal network
-- Finds all individuals connected to a target person through shared cases.
WITH RECURSIVE network AS (
    -- Base case: The target person and cases they are involved in
    SELECT 
        cp1.person_id as source_person,
        p.full_name as source_name,
        cp1.case_id,
        cp1.role as source_role,
        0 as depth
    FROM case_persons cp1
    JOIN persons p ON cp1.person_id = p.id
    WHERE cp1.person_id = :target_person_id

    UNION

    -- Recursive step: Find other people in those cases, and cases those people are in
    SELECT 
        cp2.person_id,
        p2.full_name,
        cp2.case_id,
        cp2.role,
        n.depth + 1
    FROM network n
    JOIN case_persons cp2 ON n.case_id = cp2.case_id
    JOIN persons p2 ON cp2.person_id = p2.id
    WHERE n.depth < 2  -- Limit to 2 hops
      AND cp2.person_id != n.source_person -- Don't cycle back immediately
)
SELECT DISTINCT source_person, source_name, case_id, depth FROM network ORDER BY depth;


-- 2. SIMILARITY AGENT: pgvector Cross-District MO Match
-- Finds cases with similar descriptions (embeddings) in different districts
SELECT 
    c1.fir_number as target_fir,
    s1.district as target_district,
    c2.fir_number as similar_fir,
    s2.district as similar_district,
    1 - (c1.case_embedding <=> c2.case_embedding) as similarity_score
FROM cases c1
JOIN stations s1 ON c1.station_id = s1.id
JOIN cases c2 ON c1.id != c2.id
JOIN stations s2 ON c2.station_id = s2.id
WHERE c1.id = :target_case_id
  AND s1.district != s2.district
ORDER BY c1.case_embedding <=> c2.case_embedding
LIMIT 5;


-- 3. TREND AGENT: Seasonal Hotspot Detection
-- Finds locations with spikes in specific crimes during a specific month/year
SELECT 
    l.address,
    s.district,
    COUNT(c.id) as incident_count
FROM cases c
JOIN locations l ON c.location_id = l.id
JOIN stations s ON c.station_id = s.id
JOIN offense_types ot ON c.offense_type_id = ot.id
WHERE ot.name = 'Vehicle Theft'
  AND EXTRACT(YEAR FROM c.date_filed) = 2024
  AND EXTRACT(MONTH FROM c.date_filed) = 12
GROUP BY l.address, s.district
ORDER BY incident_count DESC
LIMIT 10;


-- 4. BASELINE QUERY PERFORMANCE (To be run with EXPLAIN ANALYZE on 80K dataset)
-- EXPLAIN ANALYZE SELECT * FROM cases WHERE fir_number = 'FIR-GANG-1/2024';
-- EXPLAIN ANALYZE SELECT person_id FROM case_persons WHERE case_id = 15000;
-- EXPLAIN ANALYZE <Insert Network CTE Here>
