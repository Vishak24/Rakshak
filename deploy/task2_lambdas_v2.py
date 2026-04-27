"""Task 2: Create 4 Lambda functions with inline code + explicit credentials env vars"""
import boto3, io, zipfile, json
from botocore.exceptions import ClientError

lambda_client = boto3.client('lambda', region_name='ap-south-1')

ROLE_ARN = "arn:aws:iam::468704514492:role/rakshak-lambda-role"

# Pass through credentials so Lambdas can access new DynamoDB tables
LAMBDA_ENV = {
    "Variables": {
        "AWS_REGION_OVERRIDE": "ap-south-1",
        "RAKSHAK_AWS_ACCESS_KEY_ID": "REMOVED_SEE_ENV_EXAMPLE",
        "RAKSHAK_AWS_SECRET_ACCESS_KEY": "REMOVED_SEE_ENV_EXAMPLE",
    }
}

# ─────────────────────────────────────────────────────────────
# LAMBDA 1: rakshak-score-refresh
# ─────────────────────────────────────────────────────────────
SCORE_REFRESH_CODE = r'''
import json, os, boto3
from datetime import datetime

REGION = 'ap-south-1'
KEY_ID = os.environ.get('RAKSHAK_AWS_ACCESS_KEY_ID')
SECRET  = os.environ.get('RAKSHAK_AWS_SECRET_ACCESS_KEY')

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

ENDPOINT = 'rakshak-risk-endpoint'


def build_features(zone):
    hour = zone.get('hour', 20)
    # Parse hour from ISO timestamp if provided
    time_str = zone.get('time', '')
    if time_str:
        try:
            if 'T' in time_str:
                hour = int(time_str.split('T')[1].split(':')[0])
            elif ':' in time_str:
                hour = int(time_str.split(':')[0])
        except Exception:
            hour = 20

    day = zone.get('day_of_week', datetime.utcnow().weekday())
    is_weekend   = 1 if day in [5, 6] else 0
    is_night     = 1 if (hour >= 22 or hour <= 5) else 0
    is_evening   = 1 if (17 <= hour <= 21) else 0
    is_rush_hour = 1 if hour in [8, 9, 17, 18, 19] else 0

    pincode = int(zone.get('pincode', 600001))
    units   = int(zone.get('units', 1))

    # Derive signal counts from units available (proxy for now)
    signal_7d     = max(1, 10 - units * 2)
    signal_30d    = max(1, signal_7d * 4)
    density_ratio = round(signal_7d / signal_30d, 4)

    # Area encoding based on pincode
    area_encoded          = (pincode % 100) % 15
    neighborhood_encoded  = (pincode % 1000) % 20

    return [
        13.0827,           # latitude (Chennai center default)
        80.2707,           # longitude
        float(pincode),    # pincode
        float(hour),       # hour
        float(day),        # day_of_week
        float(is_weekend),
        float(is_night),
        float(is_evening),
        float(is_rush_hour),
        10.0,              # reporting_delay_minutes
        8.0,               # response_time_minutes
        25.0,              # victim_age
        float(signal_7d),
        float(signal_30d),
        float(density_ratio),
        float(area_encoded),
        float(neighborhood_encoded),
    ]


def lambda_handler(event, context):
    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    try:
        body  = json.loads(event.get('body', '{}') or '{}')
        zones = body.get('zones', [])
        results = []

        sagemaker_runtime = boto3.client(
            'sagemaker-runtime', region_name=REGION,
            aws_access_key_id=KEY_ID, aws_secret_access_key=SECRET,
        )

        for zone in zones:
            pincode_str = str(zone.get('pincode', '600001'))

            try:
                features = build_features(zone)
                payload  = json.dumps({"instances": [features]})

                response = sagemaker_runtime.invoke_endpoint(
                    EndpointName=ENDPOINT,
                    ContentType='application/json',
                    Body=payload,
                )
                result = json.loads(response['Body'].read().decode())

                # Unwrap nested lists: [[0.73]] → 0.73
                while isinstance(result, list):
                    result = result[0]
                if isinstance(result, dict):
                    result = result.get('predictions', result.get('score', 0.5))
                    while isinstance(result, list):
                        result = result[0]

                safe_score = float(result)

            except Exception as e:
                print(f"SageMaker error for pincode {pincode_str}: {type(e).__name__}: {e}")
                safe_score = 0.5

            # Map score to risk level
            if safe_score >= 0.6:
                risk_level = 'LOW'
            elif safe_score >= 0.3:
                risk_level = 'MEDIUM'
            else:
                risk_level = 'HIGH'

            results.append({
                'pincode':    pincode_str,
                'safe_score': round(safe_score, 4),
                'risk_level': risk_level,
            })

        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(results)}
    except Exception as e:
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}
'''

# ─────────────────────────────────────────────────────────────
# LAMBDA 2: rakshak-reports-handler
# ─────────────────────────────────────────────────────────────
REPORTS_CODE = r'''
import json, os, uuid, boto3
from boto3.dynamodb.conditions import Attr
from datetime import datetime

REGION = 'ap-south-1'
KEY_ID = os.environ.get('RAKSHAK_AWS_ACCESS_KEY_ID')
SECRET  = os.environ.get('RAKSHAK_AWS_SECRET_ACCESS_KEY')

def _table():
    ddb = boto3.resource('dynamodb', region_name=REGION,
                         aws_access_key_id=KEY_ID, aws_secret_access_key=SECRET)
    return ddb.Table('rakshak-incidents')

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

def lambda_handler(event, context):
    method = event.get('requestContext', {}).get('http', {}).get('method', 'GET')
    path   = event.get('rawPath', '')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    try:
        table = _table()

        # POST /reports/submit
        if method == 'POST' and path.endswith('/reports/submit'):
            body = json.loads(event.get('body', '{}') or '{}')
            item = {
                'incident_id': str(uuid.uuid4()),
                'created_at':  datetime.utcnow().isoformat() + 'Z',
                'status':      'pending',
            }
            item.update(body)
            table.put_item(Item=item)
            return {'statusCode': 201, 'headers': CORS, 'body': json.dumps(item)}

        # GET /reports
        if method == 'GET':
            resp  = table.scan()
            items = resp.get('Items', [])
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(items, default=str)}

        # PATCH /reports/approve/{id}
        if method == 'PATCH' and '/reports/approve/' in path:
            incident_id = path.split('/reports/approve/')[-1]
            scan = table.scan(FilterExpression=Attr('incident_id').eq(incident_id))
            items = scan.get('Items', [])
            if not items:
                return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'not found'})}
            table.update_item(
                Key={'incident_id': incident_id, 'created_at': items[0]['created_at']},
                UpdateExpression='SET #s = :s, approved_at = :t',
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={':s': 'approved', ':t': datetime.utcnow().isoformat() + 'Z'},
            )
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'incident_id': incident_id, 'status': 'approved'})}

        # PATCH /reports/reject/{id}
        if method == 'PATCH' and '/reports/reject/' in path:
            incident_id = path.split('/reports/reject/')[-1]
            scan = table.scan(FilterExpression=Attr('incident_id').eq(incident_id))
            items = scan.get('Items', [])
            if not items:
                return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'not found'})}
            table.update_item(
                Key={'incident_id': incident_id, 'created_at': items[0]['created_at']},
                UpdateExpression='SET #s = :s, rejected_at = :t',
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={':s': 'rejected', ':t': datetime.utcnow().isoformat() + 'Z'},
            )
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'incident_id': incident_id, 'status': 'rejected'})}

        return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'route not found'})}
    except Exception as e:
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}
'''

# ─────────────────────────────────────────────────────────────
# LAMBDA 3: rakshak-sos-handler
# ─────────────────────────────────────────────────────────────
SOS_CODE = r'''
import json, os, boto3
from boto3.dynamodb.conditions import Attr
from datetime import datetime

REGION = 'ap-south-1'
KEY_ID = os.environ.get('RAKSHAK_AWS_ACCESS_KEY_ID')
SECRET  = os.environ.get('RAKSHAK_AWS_SECRET_ACCESS_KEY')

def _table():
    ddb = boto3.resource('dynamodb', region_name=REGION,
                         aws_access_key_id=KEY_ID, aws_secret_access_key=SECRET)
    return ddb.Table('rakshak-sos-alerts')

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

def lambda_handler(event, context):
    method = event.get('requestContext', {}).get('http', {}).get('method', 'GET')
    path   = event.get('rawPath', '')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    try:
        table = _table()

        # GET /sos/live
        if method == 'GET' and path.endswith('/sos/live'):
            resp  = table.scan(FilterExpression=Attr('status').eq('active'))
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(resp.get('Items', []), default=str)}

        # POST /sos/dispatch/{id}
        if method == 'POST' and '/sos/dispatch/' in path:
            sos_id = path.split('/sos/dispatch/')[-1]
            table.update_item(
                Key={'sos_id': sos_id},
                UpdateExpression='SET #s = :s, dispatched_at = :t',
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={':s': 'dispatched', ':t': datetime.utcnow().isoformat() + 'Z'},
            )
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'sos_id': sos_id, 'status': 'dispatched'})}

        # PATCH /sos/resolve/{id}
        if method == 'PATCH' and '/sos/resolve/' in path:
            sos_id = path.split('/sos/resolve/')[-1]
            table.update_item(
                Key={'sos_id': sos_id},
                UpdateExpression='SET #s = :s, resolved_at = :t',
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={':s': 'resolved', ':t': datetime.utcnow().isoformat() + 'Z'},
            )
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'sos_id': sos_id, 'status': 'resolved'})}

        return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'route not found'})}
    except Exception as e:
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}
'''

# ─────────────────────────────────────────────────────────────
# LAMBDA 4: rakshak-patrol-handler
# ─────────────────────────────────────────────────────────────
PATROL_CODE = r'''
import json, os, boto3
from datetime import datetime

REGION = 'ap-south-1'
KEY_ID = os.environ.get('RAKSHAK_AWS_ACCESS_KEY_ID')
SECRET  = os.environ.get('RAKSHAK_AWS_SECRET_ACCESS_KEY')

def _table():
    ddb = boto3.resource('dynamodb', region_name=REGION,
                         aws_access_key_id=KEY_ID, aws_secret_access_key=SECRET)
    return ddb.Table('rakshak-patrols')

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

def lambda_handler(event, context):
    method      = event.get('requestContext', {}).get('http', {}).get('method', 'GET')
    path        = event.get('rawPath', '')
    path_params = event.get('pathParameters') or {}

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    try:
        table = _table()

        # GET /patrols
        if method == 'GET':
            resp  = table.scan()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(resp.get('Items', []), default=str)}

        # PATCH /patrols/{id}/status
        if method == 'PATCH' and '/status' in path:
            patrol_id = path_params.get('id') or path.split('/patrols/')[-1].split('/status')[0]
            body      = json.loads(event.get('body', '{}') or '{}')
            new_status = body.get('status', 'Unknown')
            table.update_item(
                Key={'patrol_id': patrol_id},
                UpdateExpression='SET #s = :s, updated_at = :t',
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={':s': new_status, ':t': datetime.utcnow().isoformat() + 'Z'},
            )
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'patrol_id': patrol_id, 'status': new_status})}

        return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'route not found'})}
    except Exception as e:
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}
'''


def create_or_update_lambda(name, code, description):
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
            Environment=LAMBDA_ENV,
        )
        arn = resp['FunctionArn']
        print(f"✅ Created Lambda: {name}")
        return arn
    except ClientError as e:
        if e.response['Error']['Code'] in ('ResourceConflictException', 'ResourceNotFoundException'):
            # Update code
            lambda_client.update_function_code(FunctionName=name, ZipFile=zip_bytes)
            # Update config
            import time; time.sleep(2)
            lambda_client.update_function_configuration(
                FunctionName=name,
                Environment=LAMBDA_ENV,
                Timeout=30,
                MemorySize=256,
            )
            resp = lambda_client.get_function_configuration(FunctionName=name)
            arn = resp['FunctionArn']
            print(f"🔄 Updated Lambda: {name}")
            return arn
        else:
            raise


arns = {}
arns['rakshak-score-refresh']   = create_or_update_lambda('rakshak-score-refresh',   SCORE_REFRESH_CODE, 'Refresh zone risk scores via SageMaker')
arns['rakshak-reports-handler'] = create_or_update_lambda('rakshak-reports-handler', REPORTS_CODE,       'CRUD for incident reports')
arns['rakshak-sos-handler']     = create_or_update_lambda('rakshak-sos-handler',     SOS_CODE,           'SOS alert management')
arns['rakshak-patrol-handler']  = create_or_update_lambda('rakshak-patrol-handler',  PATROL_CODE,        'Patrol unit management')

with open('/tmp/rakshak_arns.json', 'w') as f:
    json.dump(arns, f, indent=2)

print("\nAll Lambda ARNs:")
print(json.dumps(arns, indent=2))
