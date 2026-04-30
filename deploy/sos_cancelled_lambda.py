"""
Adds POST /sos/cancelled handling to the existing rakshak-sos-handler Lambda.

This script:
1. Fetches the current Lambda code
2. Patches it to handle POST /sos/cancelled
3. Redeploys the Lambda
4. Adds the API Gateway route POST /sos/cancelled → existing im4k71v integration
"""
import boto3, json, io, zipfile, base64
from botocore.exceptions import ClientError

REGION      = 'ap-south-1'
LAMBDA_NAME = 'rakshak-sos-handler'
API_ID      = 'aksdwfbnn5'
INTEGRATION = 'im4k71v'   # existing SOS handler integration

lambda_client = boto3.client('lambda', region_name=REGION)
apigw         = boto3.client('apigatewayv2', region_name=REGION)

# ── New Lambda code with /sos/cancelled added ─────────────────────────────────
NEW_SOS_CODE = r'''
import json, os, boto3
from boto3.dynamodb.conditions import Attr
from datetime import datetime

REGION = 'ap-south-1'

def _table():
    ddb = boto3.resource('dynamodb', region_name=REGION)
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
            return {'statusCode': 200, 'headers': CORS,
                    'body': json.dumps(resp.get('Items', []), default=str)}

        # POST /sos/live  — create new SOS alert
        if method == 'POST' and path.endswith('/sos/live'):
            import uuid
            body = json.loads(event.get('body', '{}') or '{}')
            sos_id = f"SOS-{uuid.uuid4().hex[:8].upper()}"
            item = {
                'sos_id':     sos_id,
                'status':     'active',
                'created_at': datetime.utcnow().isoformat() + 'Z',
            }
            # Copy all fields from body (lat, lng, latitude, longitude, pincode, etc.)
            for k, v in body.items():
                if k not in item:
                    item[k] = v
            # Ensure zone_name = pincode if not set
            if 'pincode' in item and 'zone_name' not in item:
                item['zone_name'] = str(item['pincode'])
            table.put_item(Item=item)
            return {'statusCode': 201, 'headers': CORS,
                    'body': json.dumps({'sos_id': sos_id, 'status': 'active'})}

        # POST /sos/dispatch/{id}
        if method == 'POST' and '/sos/dispatch/' in path:
            sos_id = path.split('/sos/dispatch/')[-1]
            table.update_item(
                Key={'sos_id': sos_id},
                UpdateExpression='SET #s = :s, dispatched_at = :t',
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={':s': 'dispatched',
                                           ':t': datetime.utcnow().isoformat() + 'Z'},
            )
            return {'statusCode': 200, 'headers': CORS,
                    'body': json.dumps({'sos_id': sos_id, 'status': 'dispatched'})}

        # PATCH /sos/resolve/{id}
        if method == 'PATCH' and '/sos/resolve/' in path:
            sos_id = path.split('/sos/resolve/')[-1]
            table.update_item(
                Key={'sos_id': sos_id},
                UpdateExpression='SET #s = :s, resolved_at = :t',
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={':s': 'resolved',
                                           ':t': datetime.utcnow().isoformat() + 'Z'},
            )
            return {'statusCode': 200, 'headers': CORS,
                    'body': json.dumps({'sos_id': sos_id, 'status': 'resolved'})}

        # POST /sos/cancelled  — citizen cancels their own SOS
        if method == 'POST' and path.endswith('/sos/cancelled'):
            body       = json.loads(event.get('body', '{}') or '{}')
            sos_id     = body.get('sos_id')
            user_phone = body.get('user_phone', '')
            pincode    = body.get('pincode', '')

            if not sos_id:
                return {'statusCode': 400, 'headers': CORS,
                        'body': json.dumps({'error': 'sos_id required'})}

            table.update_item(
                Key={'sos_id': sos_id},
                UpdateExpression='SET #s = :s, user_phone = :p, cancelled_at = :t',
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={
                    ':s': 'cancelled',
                    ':p': user_phone,
                    ':t': datetime.utcnow().isoformat() + 'Z',
                },
            )
            return {'statusCode': 200, 'headers': CORS,
                    'body': json.dumps({'message': 'SOS cancelled', 'sos_id': sos_id})}

        return {'statusCode': 404, 'headers': CORS,
                'body': json.dumps({'error': 'route not found'})}

    except Exception as e:
        return {'statusCode': 500, 'headers': CORS,
                'body': json.dumps({'error': str(e)})}
'''


def deploy_lambda():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('lambda_function.py', NEW_SOS_CODE.strip())
    zip_bytes = buf.getvalue()

    lambda_client.update_function_code(
        FunctionName=LAMBDA_NAME,
        ZipFile=zip_bytes,
    )
    print(f'✅ Updated Lambda: {LAMBDA_NAME}')


def add_api_route():
    # Check if route already exists
    routes = apigw.get_routes(ApiId=API_ID)['Items']
    for r in routes:
        if 'cancelled' in r.get('RouteKey', '').lower():
            print(f'ℹ️  Route already exists: {r["RouteKey"]}')
            return r['RouteId']

    # Add POST /sos/cancelled → existing SOS handler integration
    resp = apigw.create_route(
        ApiId=API_ID,
        RouteKey='POST /sos/cancelled',
        Target=f'integrations/{INTEGRATION}',
    )
    route_id = resp['RouteId']
    print(f'✅ Created route: POST /sos/cancelled (RouteId: {route_id})')

    # Grant API Gateway permission to invoke the Lambda
    try:
        lambda_client.add_permission(
            FunctionName=LAMBDA_NAME,
            StatementId='apigw-sos-cancelled',
            Action='lambda:InvokeFunction',
            Principal='apigateway.amazonaws.com',
            SourceArn=f'arn:aws:execute-api:{REGION}:468704514492:{API_ID}/*/*/sos/cancelled',
        )
        print('✅ Lambda invoke permission added')
    except ClientError as e:
        if 'ResourceConflictException' in str(e):
            print('ℹ️  Lambda permission already exists')
        else:
            print(f'⚠️  Permission error: {e}')

    return route_id


if __name__ == '__main__':
    import time
    print('=== Deploying /sos/cancelled ===')
    deploy_lambda()
    time.sleep(3)
    add_api_route()
    print('\n=== Testing /sos/cancelled ===')
    import urllib.request
    test = urllib.request.Request(
        'https://aksdwfbnn5.execute-api.ap-south-1.amazonaws.com/sos/cancelled',
        data=json.dumps({'sos_id': 'TEST-CANCEL-001', 'user_phone': '+91-9999999999'}).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(test, timeout=10) as r:
            print('Response:', r.read().decode())
    except Exception as e:
        print('Test error (expected if sos_id not in DB):', e)
