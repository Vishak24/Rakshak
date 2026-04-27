"""Task 1: Create DynamoDB tables (skip if already exists)"""
import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.client('dynamodb', region_name='ap-south-1')

tables = [
    {
        "TableName": "rakshak-incidents",
        "KeySchema": [
            {"AttributeName": "incident_id", "KeyType": "HASH"},
            {"AttributeName": "created_at", "KeyType": "RANGE"},
        ],
        "AttributeDefinitions": [
            {"AttributeName": "incident_id", "AttributeType": "S"},
            {"AttributeName": "created_at", "AttributeType": "S"},
        ],
        "BillingMode": "PAY_PER_REQUEST",
    },
    {
        "TableName": "rakshak-patrols",
        "KeySchema": [{"AttributeName": "patrol_id", "KeyType": "HASH"}],
        "AttributeDefinitions": [{"AttributeName": "patrol_id", "AttributeType": "S"}],
        "BillingMode": "PAY_PER_REQUEST",
    },
    {
        "TableName": "rakshak-zones",
        "KeySchema": [{"AttributeName": "pincode", "KeyType": "HASH"}],
        "AttributeDefinitions": [{"AttributeName": "pincode", "AttributeType": "S"}],
        "BillingMode": "PAY_PER_REQUEST",
    },
]

for table_def in tables:
    name = table_def["TableName"]
    try:
        dynamodb.create_table(**table_def)
        print(f"✅ Created table: {name}")
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceInUseException":
            print(f"⏭️  Table already exists (skipped): {name}")
        else:
            raise

# Wait for tables to be active
waiter = dynamodb.get_waiter('table_exists')
for table_def in tables:
    name = table_def["TableName"]
    print(f"⏳ Waiting for {name} to be ACTIVE...")
    waiter.wait(TableName=name)
    print(f"✅ {name} is ACTIVE")
