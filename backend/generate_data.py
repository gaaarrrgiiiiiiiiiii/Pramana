import os
import random
import datetime
from faker import Faker
import psycopg2
from psycopg2.extras import execute_values

fake = Faker('en_IN')

DB_PARAMS = {
    'dbname': 'datathon_db',
    'user': 'datathon_user',
    'password': 'datathon_password',
    'host': '127.0.0.1',
    'port': os.environ.get('DB_PORT', '5432')
}

NUM_CASES = 80000
NUM_PERSONS = 40000

# Karnataka specific data
DISTRICTS = ['Bengaluru Urban', 'Bengaluru Rural', 'Mysuru', 'Dakshina Kannada', 'Belagavi', 'Hubballi-Dharwad', 'Mangaluru', 'Udupi']
STATION_NAMES = ['Central', 'Traffic', 'Cyber Crime', 'Women Police', 'Rural', 'Town']
OFFENSES = [
    ('Theft', '379', 'Property'),
    ('Robbery', '392', 'Property'),
    ('Assault', '323', 'Violent'),
    ('Cyber Fraud', '420', 'Cyber'),
    ('Vehicle Theft', '379A', 'Property'),
    ('Burglary', '454', 'Property'),
    ('Extortion', '384', 'Violent'),
    ('Drug Possession', 'NDPS', 'Narcotics')
]

def generate_stations(cursor):
    print("Generating Stations...")
    stations = []
    station_id_map = {}
    sid = 1
    for dist in DISTRICTS:
        for name in STATION_NAMES:
            code = f"{dist[:3].upper()}-{name[:3].upper()}-{random.randint(10, 99)}"
            stations.append((sid, f"{dist} {name} PS", dist, name, code))
            station_id_map[(dist, name)] = sid
            sid += 1
    
    execute_values(cursor, 
        "INSERT INTO stations (id, name, district, taluk, station_code) VALUES %s", 
        stations)
    return stations, station_id_map

def generate_locations(cursor, stations):
    print("Generating Locations...")
    locations = []
    for i in range(1, len(stations) * 10 + 1):
        station_id = random.choice(stations)[0]
        # roughly Karnataka bounds
        lat = random.uniform(11.5, 18.5)
        lon = random.uniform(74.0, 78.5)
        address = fake.address().replace('\n', ', ')
        locations.append((i, lat, lon, address, station_id))
        
    execute_values(cursor, 
        "INSERT INTO locations (id, latitude, longitude, address, station_id) VALUES %s", 
        locations)
    return locations

def generate_offenses(cursor):
    print("Generating Offense Types...")
    offenses_db = []
    for i, (name, section, cat) in enumerate(OFFENSES, 1):
        offenses_db.append((i, name, section, cat))
        
    execute_values(cursor, 
        "INSERT INTO offense_types (id, name, ipc_section, category) VALUES %s", 
        offenses_db)
    return offenses_db

def generate_persons(cursor):
    print("Generating Persons...")
    persons = []
    for i in range(1, NUM_PERSONS + 1):
        name = fake.name()
        phone = fake.phone_number()
        age = random.randint(16, 75)
        gender = random.choice(['Male', 'Female', 'Other'])
        persons.append((i, name, [], phone, '', age, gender))
        
    # Chunking insert
    chunk_size = 10000
    for i in range(0, len(persons), chunk_size):
        execute_values(cursor, 
            "INSERT INTO persons (id, full_name, aliases, phone_number, address, age, gender) VALUES %s", 
            persons[i:i+chunk_size])
    return persons

def generate_cases_and_roles(cursor, num_cases, num_persons, locations, offenses):
    print("Generating Cases and Roles...")
    cases = []
    case_persons = []
    start_date = datetime.datetime(2023, 1, 1)
    
    for i in range(1, num_cases + 1):
        fir = f"FIR-{i}/{random.randint(2023, 2026)}"
        date_filed = start_date + datetime.timedelta(days=random.randint(0, 1000), hours=random.randint(0, 24))
        status = random.choice(['Under Investigation', 'Closed', 'Charge Sheet Filed'])
        loc = random.choice(locations)
        loc_id = loc[0]
        station_id = loc[4]
        off_id = random.choice(offenses)[0]
        desc = fake.text(max_nb_chars=200)
        
        # Fake 768-dim vector for embeddings
        embedding = [random.random() for _ in range(768)]
        
        cases.append((i, fir, date_filed, status, desc, station_id, loc_id, off_id, embedding))
        
        # Add random persons to case
        num_involved = random.randint(1, 4)
        for _ in range(num_involved):
            pid = random.randint(1, num_persons)
            role = random.choice(['suspect', 'accused', 'victim', 'witness', 'complainant'])
            case_persons.append((i, pid, role))
            
    # Insert cases
    chunk_size = 5000
    for i in range(0, len(cases), chunk_size):
        execute_values(cursor, 
            "INSERT INTO cases (id, fir_number, date_filed, status, description, station_id, location_id, offense_type_id, case_embedding) VALUES %s", 
            cases[i:i+chunk_size])
            
    # Insert case_persons
    for i in range(0, len(case_persons), chunk_size):
        execute_values(cursor, 
            "INSERT INTO case_persons (case_id, person_id, role) VALUES %s", 
            case_persons[i:i+chunk_size])

def plant_patterns(cursor, persons, locations, stations, offenses):
    print("Planting investigative patterns...")
    
    # Extract IDs for easy access
    person_ids = [p[0] for p in persons]
    
    # Helper for adding a single case
    def add_case(fir_number, date_filed, desc, loc_id, station_id, off_id, involved_roles):
        # involved_roles is a list of (person_id, role)
        # Use a zero vector for test embeddings since we will rely on semantic search for only one specific pattern
        embedding = [random.random() for _ in range(768)]
        
        execute_values(cursor, 
            "INSERT INTO cases (fir_number, date_filed, status, description, station_id, location_id, offense_type_id, case_embedding) VALUES %s RETURNING id", 
            [(fir_number, date_filed, 'Under Investigation', desc, station_id, loc_id, off_id, embedding)])
        
        # Fetch the case_id of the newly inserted case
        cursor.execute("SELECT id FROM cases WHERE fir_number = %s", (fir_number,))
        case_id = cursor.fetchone()[0]
        
        case_persons = [(case_id, pid, role) for pid, role in involved_roles]
        execute_values(cursor, "INSERT INTO case_persons (case_id, person_id, role) VALUES %s", case_persons)

    # PATTERN 1: The Gang Cluster (10 people, jointly accused in 5 cases)
    print("  -> Planting Pattern 1: Gang Cluster")
    gang_members = person_ids[:10] # Take first 10
    gang_offense_id = offenses[0][0] # Theft
    gang_loc = locations[0]
    for i in range(5):
        involved = [(pid, 'accused') for pid in gang_members]
        add_case(f"FIR-GANG-{i}/2024", datetime.datetime(2024, 6, i+1), 
                 f"Coordinated gang theft incident {i}.", gang_loc[0], gang_loc[4], gang_offense_id, involved)

    # PATTERN 2: Seasonal Hotspot (20 Vehicle Thefts in Dec 2024 in same location)
    print("  -> Planting Pattern 2: Seasonal Hotspot")
    hotspot_loc = locations[10]
    vt_offense_id = next(o[0] for o in offenses if o[1] == 'Vehicle Theft')
    for i in range(20):
        thief = random.choice(person_ids[10:100])
        add_case(f"FIR-HOTSPOT-{i}/2024", datetime.datetime(2024, 12, random.randint(1, 31)), 
                 "Motorcycle reported stolen from outside the market.", hotspot_loc[0], hotspot_loc[4], vt_offense_id, [(thief, 'suspect')])

    # PATTERN 3: Cross-District MO Match (3 identical burglaries, diff districts)
    print("  -> Planting Pattern 3: Cross-District MO Match")
    # Need locations in diff districts
    districts_seen = set()
    mo_locations = []
    for loc in locations:
        # station_id is loc[4]
        # find district for station
        st_dist = next(s[2] for s in stations if s[0] == loc[4])
        if st_dist not in districts_seen:
            districts_seen.add(st_dist)
            mo_locations.append(loc)
        if len(mo_locations) == 3:
            break
            
    mo_offense_id = next(o[0] for o in offenses if o[1] == 'Burglary')
    mo_person = person_ids[101]
    mo_desc = "entry through roof, stolen electronics, left a red cloth"
    # We will give these identical vectors to ensure they match during similarity search test
    mo_vector = [0.99] * 768 # distinctly high vector
    for i in range(3):
        loc = mo_locations[i]
        execute_values(cursor, 
            "INSERT INTO cases (fir_number, date_filed, status, description, station_id, location_id, offense_type_id, case_embedding) VALUES %s RETURNING id", 
            [(f"FIR-MO-{i}/2025", datetime.datetime(2025, i+1, 15), 'Under Investigation', mo_desc, loc[4], loc[0], mo_offense_id, mo_vector)])
        cursor.execute("SELECT id FROM cases WHERE fir_number = %s", (f"FIR-MO-{i}/2025",))
        c_id = cursor.fetchone()[0]
        execute_values(cursor, "INSERT INTO case_persons (case_id, person_id, role) VALUES %s", [(c_id, mo_person, 'accused')])

    # PATTERN 4: Escalating Offender (Petty theft -> Assault -> Robbery)
    print("  -> Planting Pattern 4: Escalating Offender")
    escalator = person_ids[102]
    esc_loc = locations[20]
    add_case("FIR-ESC-1/2023", datetime.datetime(2023, 5, 10), "Shoplifting minor goods.", esc_loc[0], esc_loc[4], next(o[0] for o in offenses if o[1] == 'Theft'), [(escalator, 'accused')])
    add_case("FIR-ESC-2/2024", datetime.datetime(2024, 8, 22), "Assault outside a bar.", esc_loc[0], esc_loc[4], next(o[0] for o in offenses if o[1] == 'Assault'), [(escalator, 'accused')])
    add_case("FIR-ESC-3/2025", datetime.datetime(2025, 2, 14), "Armed robbery of jewelry store.", esc_loc[0], esc_loc[4], next(o[0] for o in offenses if o[1] == 'Robbery'), [(escalator, 'accused')])

    # PATTERN 5: Vehicle Theft Ring (5 people, 5 stations)
    print("  -> Planting Pattern 5: Vehicle Theft Ring")
    ring_members = person_ids[200:205]
    ring_locations = locations[30:35]
    for i in range(5):
        add_case(f"FIR-RING-{i}/2025", datetime.datetime(2025, 3, i+1), "Stolen SUV.", ring_locations[i][0], ring_locations[i][4], vt_offense_id, [(ring_members[i], 'accused')])

def main():
    print("Connecting to DB...")
    conn = psycopg2.connect(**DB_PARAMS)
    cursor = conn.cursor()
    
    # Clean DB
    cursor.execute("TRUNCATE TABLE case_persons, cases, persons, locations, stations, offense_types RESTART IDENTITY CASCADE;")
    
    stations, _ = generate_stations(cursor)
    locations = generate_locations(cursor, stations)
    offenses = generate_offenses(cursor)
    persons = generate_persons(cursor)
    generate_cases_and_roles(cursor, NUM_CASES, NUM_PERSONS, locations, offenses)
    
    plant_patterns(cursor, persons, locations, stations, offenses)
    
    conn.commit()
    cursor.close()
    conn.close()
    print("Data generation complete.")

if __name__ == "__main__":
    main()
