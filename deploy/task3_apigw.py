"""Task 3: Add routes to existing API Gateway aksdwfbnn5"""
import boto3, json, time
from botocore.exceptions import ClientError

apigw = boto3.client('apigatewayv2', region_name='ap-south-1')
lam   = boto3.client('lambda',       region_name='ap-south-1')

API_ID     = 'aksdwfbnn5'
ACCOUNT_ID = '468704514492'
REGION     = 'ap-south-1'

# Load ARNs
with open('/tmp/rakshak_arns.json') as f:
    ARNS = json.load(f)

# Also add sos-handler since it was created in task 2
ARNS['rakshak-sos-handler']    = f'arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:rakshak-sos-handler'
ARNS['rakshak-patrol-handler'] = f'arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:rakshak-patrol-handler'

# Route → Lambda name mapping
ROUTES = [
    ('POST',  '/score/refresh',          'rakshak-score-refresh'),
    ('POST',  '/reports/submit',         'rakshak-reports-handler'),
    ('GET',   '/reports',                'rakshak-reports-handler'),
    ('PATCH', '/reports/approve/{id}',   'rakshak-reports-handler'),
    ('PATCH', '/reports/reject/{id}',    'rakshak-reports-handler'),
    ('GET',   '/sos/live',               'rakshak-sos-handler'),
    ('POST',  '/sos/dispatch/{id}',      'rakshak-sos-handler'),
    ('PATCH', '/sos/resolve/{id}',       'rakshak-sos-handler'),
    ('GET',   '/patrols',                'rakshak-patrol-handler'),
    ('PATCH', '/patrols/{id}/status',    'rakshak-patrol-handler'),
]

# OPTIONS paths (CORS preflight)
OPTIONS_PATHS = set(path for _, path, _ in ROUTES)

# ── Step 1: fetch existing integrations ──────────────────────
existing_integrations = {}
try:
    pager = apigw.get_paginator('get_integrations')
    for page in pager.paginate(ApiId=API_ID):
        for intg in page['Items']:
            uri = intg.get('IntegrationUri', '')
            existing_integrations[uri] = intg['IntegrationId']
except Exception as e:
    print(f"Warning getting integrations: {e}")

# ── Step 2: fetch existing routes ────────────────────────────
existing_routes = {}
try:
    pager = apigw.get_paginator('get_routes')
    for page in pager.paginate(ApiId=API_ID):
        for r in page['Items']:
            key = r['RouteKey']  # e.g. "POST /score/refresh"
            existing_routes[key] = r['RouteId']
except Exception as e:
    print(f"Warning getting routes: {e}")

print(f"Existing routes: {list(existing_routes.keys())}")


def get_or_create_integration(lambda_name):
    fn_arn = ARNS[lambda_name]
    uri    = f'arn:aws:apigateway:{REGION}:lambda:path/2015-03-31/functions/{fn_arn}/invocations'

    if uri in existing_integrations:
        intg_id = existing_integrations[uri]
        print(f"  ⏭️  Reusing integration {intg_id} for {lambda_name}")
        return intg_id

    resp = apigw.create_integration(
        ApiId=API_ID,
        IntegrationType='AWS_PROXY',
        IntegrationUri=uri,
        PayloadFormatVersion='2.0',
    )
    intg_id = resp['IntegrationId']
    existing_integrations[uri] = intg_id
    print(f"  ✅ Created integration {intg_id} for {lambda_name}")
    return intg_id


def get_or_create_route(method, path, intg_id):
    route_key = f'{method} {path}'
    if route_key in existing_routes:
        print(f"  ⏭️  Route already exists: {route_key}")
        return existing_routes[route_key]

    resp = apigw.create_route(
        ApiId=API_ID,
        RouteKey=route_key,
        Target=f'integrations/{intg_id}',
    )
    route_id = resp['RouteId']
    existing_routes[route_key] = route_id
    print(f"  ✅ Created route: {route_key} → {route_id}")
    return route_id


def ensure_lambda_permission(lambda_name, method, path):
    fn_name    = lambda_name
    stmt_id    = f'apigw-{method.lower()}-{path.replace("/","-").replace("{","").replace("}","")}'
    source_arn = f'arn:aws:execute-api:{REGION}:{ACCOUNT_ID}:{API_ID}/*/*'

    try:
        lam.add_permission(
            FunctionName=fn_name,
            StatementId=stmt_id,
            Action='lambda:InvokeFunction',
            Principal='apigateway.amazonaws.com',
            SourceArn=source_arn,
        )
        print(f"  ✅ Added invoke permission for {fn_name}")
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceConflictException':
            pass  # already exists
        else:
            print(f"  ⚠️  Permission error for {fn_name}: {e}")


# ── Step 3: create routes and integrations ───────────────────
lambda_intg_cache = {}

for method, path, lambda_name in ROUTES:
    print(f"\n▶ {method} {path} → {lambda_name}")

    if lambda_name not in lambda_intg_cache:
        lambda_intg_cache[lambda_name] = get_or_create_integration(lambda_name)
    intg_id = lambda_intg_cache[lambda_name]

    get_or_create_route(method, path, intg_id)
    ensure_lambda_permission(lambda_name, method, path)

# ── Step 4: OPTIONS routes for CORS ─────────────────────────
# Use score-refresh integration as a dummy — API GW returns CORS headers from Lambda
print("\n▶ OPTIONS routes for CORS preflight")
# For HTTP API v2, a catch-all OPTIONS route is cleanest
options_key = 'OPTIONS /{proxy+}'
if options_key not in existing_routes:
    # Use any integration (score-refresh handles OPTIONS inline)
    dummy_intg = lambda_intg_cache.get('rakshak-score-refresh') or list(lambda_intg_cache.values())[0]
    try:
        resp = apigw.create_route(
            ApiId=API_ID,
            RouteKey=options_key,
            Target=f'integrations/{dummy_intg}',
        )
        print(f"  ✅ Created catch-all OPTIONS route → {resp['RouteId']}")
    except ClientError as e:
        print(f"  OPTIONS: {e}")
else:
    print(f"  ⏭️  OPTIONS route already exists")

# ── Step 5: deploy the API ────────────────────────────────────
print("\n▶ Deploying API...")
try:
    # Find existing $default stage
    stages = apigw.get_stages(ApiId=API_ID)['Items']
    stage_name = stages[0]['StageName'] if stages else '$default'
    print(f"  Stage: {stage_name}")

    deploy = apigw.create_deployment(ApiId=API_ID)
    deploy_id = deploy['DeploymentId']
    print(f"  ✅ Created deployment: {deploy_id}")

    apigw.update_stage(
        ApiId=API_ID,
        StageName=stage_name,
        DeploymentId=deploy_id,
    )
    print(f"  ✅ Stage '{stage_name}' updated to deployment {deploy_id}")
except Exception as e:
    print(f"  Deploy note: {e}")

print("\n✅ API Gateway setup complete!")
print(f"Base URL: https://{API_ID}.execute-api.{REGION}.amazonaws.com")
