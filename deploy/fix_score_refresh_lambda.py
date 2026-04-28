"""
Fix rakshak-score-refresh Lambda.

Root causes identified:
1. The v2 Lambda called SageMaker directly with a raw feature array.
   SageMaker returns a regression value > 1.0 (e.g. 2.0), not a probability.
   The threshold `safe_score >= 0.6 → LOW` always fires because 2.0 >= 0.6.

2. The correct path is to invoke `rakshak-test-inference` (the /predict Lambda)
   per zone, which handles feature engineering internally and returns:
   { risk_level: "High"|"Medium"|"Low", risk_index: 0-100, confidence: 0-1 }

3. safe_score should be derived as 1 - (risk_index / 100) so that:
   - HIGH risk  → low safe_score  (e.g. risk_index=94 → safe_score=0.06)
   - LOW risk   → high safe_score (e.g. risk_index=20 → safe_score=0.80)

4. The original task2_lambdas.py used thresholds:
   score >= 0.7 → HIGH, >= 0.4 → MEDIUM, else LOW
   But since we now use safe_score = 1 - risk_index/100, we invert:
   safe_score < 0.3  → HIGH  (risk_index > 70)
   safe_score < 0.6  → MEDIUM (risk_index > 40)
   else              → LOW

Zone lat/lon lookup table for the 44 Chennai pincodes used by the dashboard.
"""
import boto3, io, zipfile, json, os
from botocore.exceptions import ClientError

lambda_client = boto3.client('lambda', region_name='ap-south-1')

FIXED_SCORE_REFRESH_CODE = r'''
import json, os, boto3, urllib.request, urllib.error
from datetime import datetime

REGION  = 'ap-south-1'
KEY_ID  = os.environ.get('RAKSHAK_AWS_ACCESS_KEY_ID')
SECRET  = os.environ.get('RAKSHAK_AWS_SECRET_ACCESS_KEY')

# Public HTTP endpoint — no IAM needed
PREDICT_URL = 'https://aksdwfbnn5.execute-api.ap-south-1.amazonaws.com/predict'

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

# Lat/lon lookup for Chennai pincodes (matches dashboard ZONES array)
PINCODE_COORDS = {
    '600001': (13.0827, 80.2707), '600002': (13.0878, 80.2785),
    '600003': (13.0950, 80.2866), '600004': (13.0732, 80.2609),
    '600005': (13.0569, 80.2787), '600006': (13.0715, 80.2740),
    '600007': (13.1127, 80.2966), '600008': (13.1186, 80.2487),
    '600009': (13.1483, 80.2355), '600010': (13.1675, 80.2617),
    '600011': (13.0827, 80.2487), '600012': (13.0950, 80.2193),
    '600013': (13.0732, 80.2193), '600014': (13.0339, 80.2553),
    '600015': (13.0339, 80.2707), '600017': (13.0067, 80.2570),
    '600018': (13.0521, 80.2193), '600019': (13.0475, 80.2030),
    '600020': (13.0521, 80.2118), '600024': (12.9815, 80.2209),
    '600028': (12.9995, 80.2666), '600029': (12.9845, 80.2657),
    '600032': (13.0350, 80.2323), '600033': (13.0521, 80.2030),
    '600034': (13.0339, 80.2193), '600035': (13.0402, 80.2091),
    '600036': (13.0883, 80.2105), '600040': (13.0850, 80.2101),
    '600042': (13.0883, 80.1762), '600044': (13.0339, 80.1575),
    '600045': (13.0237, 80.1762), '600050': (12.9673, 80.1501),
    '600053': (12.9515, 80.1438), '600056': (12.9625, 80.2387),
    '600061': (12.9000, 80.2277), '600064': (12.9240, 80.1958),
    '600073': (12.9150, 80.1501), '600078': (13.1144, 80.1606),
    '600082': (13.1675, 80.2355), '600083': (13.1483, 80.2355),
    '600099': (13.1186, 80.2091), '600118': (12.9065, 80.1958),
}


def call_predict(pincode, hour, day_of_week):
    """Call /predict via HTTP — no IAM needed, uses the public API Gateway URL."""
    lat, lon = PINCODE_COORDS.get(str(pincode), (13.0827, 80.2707))
    is_night   = 1 if (hour < 6 or hour >= 22) else 0
    is_weekend = 1 if day_of_week in [5, 6] else 0

    payload = json.dumps({
        'lat':       lat,
        'lon':       lon,
        'hour':      hour,
        'dayofweek': day_of_week,
        'isnight':   is_night,
        'isweekend': is_weekend,
    }).encode()

    req = urllib.request.Request(
        PREDICT_URL,
        data=payload,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())
    # Returns: { risk_level: "High"|"Medium"|"Low", risk_index: 0-100, confidence: 0-1 }


def lambda_handler(event, context):
    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    try:
        body  = json.loads(event.get('body', '{}') or '{}')
        zones = body.get('zones', [])

        now = datetime.utcnow()
        default_hour = now.hour
        default_dow  = now.weekday()

        results = []
        for zone in zones:
            pincode_str = str(zone.get('pincode', '600001'))
            hour        = int(zone.get('hour', default_hour))
            day_of_week = int(zone.get('day_of_week', default_dow))

            try:
                pred = call_predict(pincode_str, hour, day_of_week)

                # /predict returns risk_level as "High"/"Medium"/"Low"
                raw_level  = str(pred.get('risk_level', 'Low')).upper()
                risk_index = float(pred.get('risk_index', 50))

                # Normalise risk_level
                if 'HIGH' in raw_level:
                    risk_level = 'HIGH'
                elif 'MED' in raw_level:
                    risk_level = 'MEDIUM'
                else:
                    risk_level = 'LOW'

                # safe_score: 1 - normalised risk_index (0-100 → 0.0-1.0)
                # HIGH risk (index=94) → safe_score=0.06
                # LOW risk  (index=20) → safe_score=0.80
                safe_score = round(1.0 - (risk_index / 100.0), 4)
                safe_score = max(0.0, min(1.0, safe_score))

                print(f"[score-refresh] {pincode_str} h={hour} dow={day_of_week} "
                      f"risk_index={risk_index} risk_level={risk_level} safe_score={safe_score}")

            except Exception as e:
                print(f"[score-refresh] ERROR {pincode_str}: {type(e).__name__}: {e}")
                risk_level = 'MEDIUM'
                safe_score = 0.5

            results.append({
                'pincode':    pincode_str,
                'safe_score': safe_score,
                'risk_level': risk_level,
            })

        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({'results': results}),
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': CORS,
            'body': json.dumps({'error': str(e)}),
        }
'''


def deploy():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('lambda_function.py', FIXED_SCORE_REFRESH_CODE.strip())
    zip_bytes = buf.getvalue()

    try:
        lambda_client.update_function_code(
            FunctionName='rakshak-score-refresh',
            ZipFile=zip_bytes,
        )
        print('✅ Updated rakshak-score-refresh code')
    except ClientError as e:
        print(f'❌ update_function_code failed: {e}')
        raise

    import time; time.sleep(3)

    try:
        lambda_client.update_function_configuration(
            FunctionName='rakshak-score-refresh',
            Timeout=60,
            MemorySize=256,
        )
        print('✅ Updated configuration (timeout=60s)')
    except ClientError as e:
        print(f'⚠️  update_function_configuration failed: {e}')


def test():
    """Test the live endpoint with 3 pincodes × 2 time slots."""
    import urllib.request

    url = 'https://aksdwfbnn5.execute-api.ap-south-1.amazonaws.com/score/refresh'
    test_cases = [
        # (label, zones payload)
        ('Late night weekend (expect HIGH)', [
            {'pincode': '600001', 'hour': 23, 'day_of_week': 6},
            {'pincode': '600034', 'hour': 2,  'day_of_week': 6},
            {'pincode': '600017', 'hour': 1,  'day_of_week': 5},
        ]),
        ('Daytime weekday (expect lower risk)', [
            {'pincode': '600001', 'hour': 14, 'day_of_week': 2},
            {'pincode': '600034', 'hour': 10, 'day_of_week': 1},
            {'pincode': '600017', 'hour': 9,  'day_of_week': 3},
        ]),
    ]

    for label, zones in test_cases:
        print(f'\n── {label} ──')
        req = urllib.request.Request(
            url,
            data=json.dumps({'zones': zones}).encode(),
            headers={'Content-Type': 'application/json'},
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            result = json.loads(r.read())
        # Handle both bare array and {"results": [...]} wrapper
        items = result.get('results', result) if isinstance(result, dict) else result
        for item in items:
            print(f"  {item['pincode']}  safe_score={item['safe_score']}  risk_level={item['risk_level']}")


if __name__ == '__main__':
    import sys
    if '--test-only' in sys.argv:
        print('=== Testing live endpoint (no deploy) ===')
        test()
    else:
        print('=== Deploying fixed rakshak-score-refresh Lambda ===')
        deploy()
        print('\n=== Waiting 5s for Lambda to update ===')
        import time; time.sleep(5)
        print('\n=== Testing live endpoint ===')
        test()
