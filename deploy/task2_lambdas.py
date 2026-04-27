"""Task 2: Create 4 Lambda functions with inline code"""
import boto3, json, textwrap
from botocore.exceptions import ClientError

lambda_client = boto3.client('lambda', region_name='ap-south-1')

ROLE_ARN = "arn:aws:iam::468704514492:role/service-role/AmazonSageMaker-ExecutionRole-20260406T145594"

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

# ─────────────────────────────────────────────────────────────
# LAMBDA 1: rakshak-score-refresh
# ─────────────────────────────────────────────────────────────
SCORE_REFRESH_CODE = '''
import json
import boto3
from datetime import datetime

lambda_client = boto3.client("lambda", region_name="ap-south-1")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    try:
        body = json.loads(event.get("body", "{}") or "{}")
        zones = body.get("zones", [])
        results = []

        now = datetime.utcnow()
        dow = now.weekday()  # 0=Mon, 6=Sun
        is_weekend = 1 if dow >= 5 else 0

        for zone in zones:
            pincode = zone.get("pincode", "600001")
            time_str = zone.get("time", "12:00")
            hour = int(time_str.split(":")[0])

            is_night = 1 if hour < 6 or hour >= 22 else 0
            is_evening = 1 if 17 <= hour < 22 else 0
            is_rush_hour = 1 if (7 <= hour <= 9) or (17 <= hour <= 19) else 0

            payload = {
                "pincode": pincode,
                "hour": hour,
                "day_of_week": dow,
                "is_weekend": is_weekend,
                "is_night": is_night,
                "is_evening": is_evening,
                "is_rush_hour": is_rush_hour,
                "reporting_delay_minutes": 10,
                "response_time_minutes": 8,
                "victim_age": 30,
                "signal_count_last_7d": 5,
                "signal_count_last_30d": 15,
                "signal_density_ratio": 0.33,
                "area_encoded": 1,
                "neighborhood_encoded": 1,
            }

            try:
                resp = lambda_client.invoke(
                    FunctionName="rakshak-test-inference",
                    InvocationType="RequestResponse",
                    Payload=json.dumps(payload),
                )
                raw = json.loads(resp["Payload"].read())
                # Handle both direct score and body-wrapped score
                if isinstance(raw, dict):
                    score = raw.get("safe_score") or raw.get("score") or 0.5
                    if "body" in raw:
                        inner = json.loads(raw["body"]) if isinstance(raw["body"], str) else raw["body"]
                        score = inner.get("safe_score") or inner.get("score") or score
                else:
                    score = float(raw) if raw else 0.5
            except Exception as e:
                score = 0.5  # default on inference error

            score = float(score)
            if score >= 0.7:
                risk_level = "HIGH"
            elif score >= 0.4:
                risk_level = "MEDIUM"
            else:
                risk_level = "LOW"

            results.append({
                "pincode": pincode,
                "safe_score": round(score, 4),
                "risk_level": risk_level,
            })

        return {
            "statusCode": 200,
            "headers": CORS,
            "body": json.dumps(results),
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": CORS,
            "body": json.dumps({"error": str(e)}),
        }
'''

# ─────────────────────────────────────────────────────────────
# LAMBDA 2: rakshak-reports-handler
# ─────────────────────────────────────────────────────────────
REPORTS_CODE = '''
import json
import boto3
import uuid
from datetime import datetime

dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
table = dynamodb.Table("rakshak-incidents")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

def lambda_handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path = event.get("rawPath", "")

    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    try:
        # POST /reports/submit
        if method == "POST" and path.endswith("/reports/submit"):
            body = json.loads(event.get("body", "{}") or "{}")
            item = {
                "incident_id": str(uuid.uuid4()),
                "created_at": datetime.utcnow().isoformat() + "Z",
                "status": "pending",
            }
            item.update(body)
            table.put_item(Item=item)
            return {"statusCode": 201, "headers": CORS, "body": json.dumps(item)}

        # GET /reports
        if method == "GET" and (path.endswith("/reports") or path == "/reports"):
            resp = table.scan()
            items = resp.get("Items", [])
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(items, default=str)}

        # PATCH /reports/approve/{id}
        if method == "PATCH" and "/reports/approve/" in path:
            incident_id = path.split("/reports/approve/")[-1]
            # Need to get the item first to retrieve created_at (SK)
            scan = table.scan(
                FilterExpression=boto3.dynamodb.conditions.Attr("incident_id").eq(incident_id)
            )
            items = scan.get("Items", [])
            if not items:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "not found"})}
            created_at = items[0]["created_at"]
            table.update_item(
                Key={"incident_id": incident_id, "created_at": created_at},
                UpdateExpression="SET #s = :s, approved_at = :t",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={":s": "approved", ":t": datetime.utcnow().isoformat() + "Z"},
            )
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"incident_id": incident_id, "status": "approved"})}

        # PATCH /reports/reject/{id}
        if method == "PATCH" and "/reports/reject/" in path:
            incident_id = path.split("/reports/reject/")[-1]
            scan = table.scan(
                FilterExpression=boto3.dynamodb.conditions.Attr("incident_id").eq(incident_id)
            )
            items = scan.get("Items", [])
            if not items:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "not found"})}
            created_at = items[0]["created_at"]
            table.update_item(
                Key={"incident_id": incident_id, "created_at": created_at},
                UpdateExpression="SET #s = :s, rejected_at = :t",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={":s": "rejected", ":t": datetime.utcnow().isoformat() + "Z"},
            )
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"incident_id": incident_id, "status": "rejected"})}

        return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "route not found"})}

    except Exception as e:
        return {"statusCode": 500, "headers": CORS, "body": json.dumps({"error": str(e)})}
'''

# ─────────────────────────────────────────────────────────────
# LAMBDA 3: rakshak-sos-handler
# ─────────────────────────────────────────────────────────────
SOS_CODE = '''
import json
import boto3
from boto3.dynamodb.conditions import Attr
from datetime import datetime

dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
table = dynamodb.Table("rakshak-sos-alerts")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

def lambda_handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path = event.get("rawPath", "")

    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    try:
        # GET /sos/live
        if method == "GET" and path.endswith("/sos/live"):
            resp = table.scan(FilterExpression=Attr("status").eq("active"))
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(resp.get("Items", []), default=str)}

        # POST /sos/dispatch/{id}
        if method == "POST" and "/sos/dispatch/" in path:
            sos_id = path.split("/sos/dispatch/")[-1]
            table.update_item(
                Key={"sos_id": sos_id},
                UpdateExpression="SET #s = :s, dispatched_at = :t",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={":s": "dispatched", ":t": datetime.utcnow().isoformat() + "Z"},
            )
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"sos_id": sos_id, "status": "dispatched"})}

        # PATCH /sos/resolve/{id}
        if method == "PATCH" and "/sos/resolve/" in path:
            sos_id = path.split("/sos/resolve/")[-1]
            table.update_item(
                Key={"sos_id": sos_id},
                UpdateExpression="SET #s = :s, resolved_at = :t",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={":s": "resolved", ":t": datetime.utcnow().isoformat() + "Z"},
            )
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"sos_id": sos_id, "status": "resolved"})}

        return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "route not found"})}

    except Exception as e:
        return {"statusCode": 500, "headers": CORS, "body": json.dumps({"error": str(e)})}
'''

# ─────────────────────────────────────────────────────────────
# LAMBDA 4: rakshak-patrol-handler
# ─────────────────────────────────────────────────────────────
PATROL_CODE = '''
import json
import boto3
from datetime import datetime

dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
table = dynamodb.Table("rakshak-patrols")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

def lambda_handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path = event.get("rawPath", "")
    path_params = event.get("pathParameters") or {}

    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    try:
        # GET /patrols
        if method == "GET":
            resp = table.scan()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(resp.get("Items", []), default=str)}

        # PATCH /patrols/{id}/status
        if method == "PATCH" and "/status" in path:
            patrol_id = path_params.get("id") or path.split("/patrols/")[-1].split("/status")[0]
            body = json.loads(event.get("body", "{}") or "{}")
            new_status = body.get("status", "Unknown")
            table.update_item(
                Key={"patrol_id": patrol_id},
                UpdateExpression="SET #s = :s, updated_at = :t",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={":s": new_status, ":t": datetime.utcnow().isoformat() + "Z"},
            )
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"patrol_id": patrol_id, "status": new_status})}

        return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "route not found"})}

    except Exception as e:
        return {"statusCode": 500, "headers": CORS, "body": json.dumps({"error": str(e)})}
'''


def create_or_update_lambda(name, code, description):
    import io, zipfile
    # Create zip in memory
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('lambda_function.py', code.strip())
    zip_bytes = buf.getvalue()

    try:
        resp = lambda_client.create_function(
            FunctionName=name,
            Runtime='python3.12',
            Role=ROLE_ARN,
            Handler='lambda_function.lambda_handler',
            Code={'ZipFile': zip_bytes},
            Description=description,
            Timeout=30,
            MemorySize=256,
        )
        print(f"✅ Created Lambda: {name} — ARN: {resp['FunctionArn']}")
        return resp['FunctionArn']
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceConflictException':
            # Update existing
            resp = lambda_client.update_function_code(
                FunctionName=name,
                ZipFile=zip_bytes,
            )
            arn = resp['FunctionArn']
            print(f"🔄 Updated Lambda: {name} — ARN: {arn}")
            return arn
        else:
            raise


arns = {}
arns['rakshak-score-refresh']   = create_or_update_lambda('rakshak-score-refresh',   SCORE_REFRESH_CODE, 'Refresh zone risk scores via ML inference')
arns['rakshak-reports-handler'] = create_or_update_lambda('rakshak-reports-handler', REPORTS_CODE,       'CRUD for incident reports')
arns['rakshak-sos-handler']     = create_or_update_lambda('rakshak-sos-handler',     SOS_CODE,           'SOS alert management')
arns['rakshak-patrol-handler']  = create_or_update_lambda('rakshak-patrol-handler',  PATROL_CODE,        'Patrol unit management')

# Save ARNs for next script
import json as _json
with open('/tmp/rakshak_arns.json', 'w') as f:
    _json.dump(arns, f, indent=2)

print("\nAll Lambda ARNs saved to /tmp/rakshak_arns.json")
print(_json.dumps(arns, indent=2))
