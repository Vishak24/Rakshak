"""Task 3: Add routes to existing API Gateway using default profile credentials"""
import boto3, json, time
from botocore.exceptions import ClientError

session = boto3.Session(profile_name='default')
apigw   = session.client('apigatewayv2', region_name='ap-south-1')
lam     = session.client('lambda',       region_name='ap-south-1')

API_ID     = 'aksdwfbnn5'
ACCOUNT_ID = '468704514492'
REGION     = 'ap-south-1'

ARNS = {
    'rakshak-score-refresh':   f'arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:rakshak-score-refresh',
    'rakshak-reports-handler': f'arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:rakshak-reports-handler',
    'rakshak-sos-handler':     f'arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:rakshak-sos-handler',
    'rakshak-patrol-handler':  f'arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:rakshak-patrol-handler',
}

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

# ── Fetch existing state ──────────────────────────────────────
existing_integrations = {}  # uri → intg_id
for intg in apigw.get_integrations(ApiId=API_ID)['Items']:
    uri = intg.get('IntegrationUri', '')
    existing_integrations[uri] = intg['IntegrationId']

existing_routes = {}  # "METHOD /path" → route_id
for r in apigw.get_routes(ApiId=API_ID)['Items']:
    existing_routes[r['RouteKey']] = r['RouteId']

print(f"Existing integrations: {len(existing_integrations)}")
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
        print(f"  ⏭️  Route exists: {route_key}")
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
    # Sanitise statement ID
    stmt_id = f'apigw-{method.lower()}{path.replace("/","-").replace("{","").replace("}","").replace("--","-")}'
    stmt_id = stmt_id[:100]
    source_arn = f'arn:aws:execute-api:{REGION}:{ACCOUNT_ID}:{API_ID}/*/*'

    try:
        lam.add_permission(
            FunctionName=lambda_name,
            StatementId=stmt_id,
            Action='lambda:InvokeFunction',
            Principal='apigateway.amazonaws.com',
            SourceArn=source_arn,
        )
    except ClientError as e:
        if e.response['Error']['Code'] != 'ResourceConflictException':
            print(f"  ⚠️  Permission {lambda_name}: {e.response['Error']['Code']}")


# ── Create routes ─────────────────────────────────────────────
lambda_intg_cache = {}

for method, path, lambda_name in ROUTES:
    print(f"\n▶ {method} {path} → {lambda_name}")
    if lambda_name not in lambda_intg_cache:
        lambda_intg_cache[lambda_name] = get_or_create_integration(lambda_name)
    intg_id = lambda_intg_cache[lambda_name]
    get_or_create_route(method, path, intg_id)
    ensure_lambda_permission(lambda_name, method, path)

# ── Catch-all OPTIONS route ───────────────────────────────────
print("\n▶ OPTIONS /{proxy+} catch-all")
options_key = 'OPTIONS /{proxy+}'
if options_key not in existing_routes:
    dummy_intg = list(lambda_intg_cache.values())[0]
    try:
        resp = apigw.create_route(
            ApiId=API_ID,
            RouteKey=options_key,
            Target=f'integrations/{dummy_intg}',
        )
        print(f"  ✅ Created: {options_key} → {resp['RouteId']}")
    except Exception as e:
        print(f"  OPTIONS: {e}")
else:
    print(f"  ⏭️  Already exists")

# ── Deploy ────────────────────────────────────────────────────
print("\n▶ Deploying API...")
stages = apigw.get_stages(ApiId=API_ID)['Items']
stage_name = stages[0]['StageName'] if stages else '$default'

deploy = apigw.create_deployment(ApiId=API_ID)
deploy_id = deploy['DeploymentId']
apigw.update_stage(ApiId=API_ID, StageName=stage_name, DeploymentId=deploy_id)
print(f"  ✅ Deployed to stage '{stage_name}' (deployment {deploy_id})")

# ── Final route list ──────────────────────────────────────────
print("\n══ Final route list ══")
all_routes = apigw.get_routes(ApiId=API_ID)['Items']
for r in sorted(all_routes, key=lambda x: x['RouteKey']):
    print(f"  {r['RouteKey']}")

print(f"\n✅ Done — Base URL: https://{API_ID}.execute-api.{REGION}.amazonaws.com")
