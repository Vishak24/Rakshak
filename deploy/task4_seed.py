"""Task 4: Seed test data into DynamoDB tables"""
import boto3, json, uuid, os
from datetime import datetime, timedelta
from decimal import Decimal

# Use the credentials that have DynamoDB access
# Set RAKSHAK_AWS_ACCESS_KEY_ID and RAKSHAK_AWS_SECRET_ACCESS_KEY as environment variables before running
ddb = boto3.resource(
    'dynamodb', region_name='ap-south-1',
    aws_access_key_id=os.environ["RAKSHAK_AWS_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["RAKSHAK_AWS_SECRET_ACCESS_KEY"],
)

now = datetime.utcnow()

# ── rakshak-patrols ───────────────────────────────────────────
patrols_table = ddb.Table('rakshak-patrols')

patrol_items = [
    {"patrol_id": "P001", "officer": "Ravi Kumar",   "zone": "600001", "status": "Patrolling",  "vehicle": "TN01 AA 1234"},
    {"patrol_id": "P002", "officer": "Priya Nair",   "zone": "600034", "status": "AtScene",     "vehicle": "TN01 BB 5678"},
    {"patrol_id": "P003", "officer": "Arun Selvam",  "zone": "600041", "status": "Responding",  "vehicle": "TN01 CC 9012"},
]

print("=== Seeding rakshak-patrols ===")
for item in patrol_items:
    patrols_table.put_item(Item=item)
    print(f"  ✅ {item['patrol_id']} — {item['officer']} ({item['status']})")

# ── rakshak-sos-alerts ────────────────────────────────────────
sos_table = ddb.Table('rakshak-sos-alerts')

sos_items = [
    {
        "sos_id":     "SOS001",
        "location":   "Anna Nagar, Chennai",
        "lat":        "13.0850",
        "lng":        "80.2101",
        "status":     "active",
        "created_at": now.isoformat() + "Z",
        "reporter":   "Anonymous",
    },
    {
        "sos_id":     "SOS002",
        "location":   "T. Nagar, Chennai",
        "lat":        "13.0418",
        "lng":        "80.2341",
        "status":     "active",
        "created_at": (now - timedelta(minutes=12)).isoformat() + "Z",
        "reporter":   "Anonymous",
    },
]

print("\n=== Seeding rakshak-sos-alerts ===")
for item in sos_items:
    sos_table.put_item(Item=item)
    print(f"  ✅ {item['sos_id']} — {item['location']} ({item['status']})")

# ── rakshak-incidents ─────────────────────────────────────────
incidents_table = ddb.Table('rakshak-incidents')

pincodes = ["600001", "600034", "600041"]
statuses = ["approved", "approved", "approved", "pending", "pending"]

ML_DEFAULTS = {
    "hour":                      18,
    "day_of_week":               3,
    "is_weekend":                0,
    "is_night":                  0,
    "is_evening":                1,
    "is_rush_hour":              1,
    "reporting_delay_minutes":   10,
    "response_time_minutes":     8,
    "victim_age":                30,
    "signal_count_last_7d":      5,
    "signal_count_last_30d":     15,
    "signal_density_ratio":      Decimal("0.33"),
    "area_encoded":              1,
    "neighborhood_encoded":      1,
}

incident_rows = [
    {
        "pincode":     "600001",
        "description": "Suspicious activity near bus stop",
        "type":        "harassment",
    },
    {
        "pincode":     "600034",
        "description": "Unlit alley reported",
        "type":        "infrastructure",
    },
    {
        "pincode":     "600041",
        "description": "Drunk individual harassing commuters",
        "type":        "harassment",
    },
    {
        "pincode":     "600001",
        "description": "CCTV vandalism spotted",
        "type":        "vandalism",
    },
    {
        "pincode":     "600034",
        "description": "Street light outage on main road",
        "type":        "infrastructure",
    },
]

print("\n=== Seeding rakshak-incidents ===")
for i, row in enumerate(incident_rows):
    days_ago = i * 1  # spread over last 5 days
    ts = (now - timedelta(days=days_ago, hours=i)).isoformat() + "Z"
    item = {
        "incident_id": str(uuid.uuid4()),
        "created_at":  ts,
        "status":      statuses[i],
    }
    item.update(row)
    item.update(ML_DEFAULTS)
    incidents_table.put_item(Item=item)
    print(f"  ✅ {item['incident_id'][:8]}… {row['pincode']} {statuses[i]} ({row['type']})")

print("\n✅ All seed data inserted!")

# Verify counts
for name, table in [('patrols', patrols_table), ('sos-alerts', sos_table), ('incidents', incidents_table)]:
    count = table.scan(Select='COUNT')['Count']
    print(f"  rakshak-{name}: {count} items")
