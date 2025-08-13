# Spica Passport Module: Authentication & Authorization Guide

## Overview

The Passport module in Spica provides a comprehensive authentication and authorization system built around three core concepts:

- **Identities**: User accounts that can authenticate to the system
- **API Keys**: Service-to-service authentication tokens
- **Policies**: Fine-grained access control rules that define what actions can be performed

This guide provides detailed documentation with real-world examples for developers and system administrators.

## Table of Contents

1. [Identities](#identities)
2. [API Keys](#api-keys)
3. [Policies](#policies)
4. [Authentication Methods](#authentication-methods)
5. [Policy Assignment](#policy-assignment)
6. [API Examples](#api-examples)
7. [Schema Reference](#schema-reference)

---

## Identities

Identities represent user accounts in the Spica system. Each identity has credentials and can be assigned policies for access control.

### Identity Schema

```json
{
  "_id": "ObjectId",
  "identifier": "string",
  "password": "string",
  "policies": ["string"],
  "attributes": {},
  "deactivateJwtsBefore": "number",
  "lastLogin": "Date",
  "failedAttempts": ["Date"],
  "lastPasswords": ["string"]
}
```

### Identity API Operations

#### 1. List Identities

```http
GET /api/passport/identity
Authorization: IDENTITY <jwt_token> OR APIKEY <api_key>
```

```http
GET /api/passport/identity?limit=1
Authorization: IDENTITY <jwt_token> OR APIKEY <api_key>
```

> Will only get 1 identity

**Query Parameters:**

- `limit`: Maximum number of results (default: 0 = no limit)
- `skip`: Number of results to skip (default: 0)
- `sort`: Sorting criteria as JSON object

> **Response:**

```json
{
    {
      "_id": "60f7b1234567890abcdef123",
      "identifier": "admin",
      "policies": ["PassportFullAccess"],
      "attributes": {
            "verified": true,
            "role": "admin",
      },
      "lastLogin": "2023-08-12T10:30:00.000Z",
      "failedAttempts": []
    },
    {
      "_id": "62f7b1234567890abcdef321",
      "identifier": "user",
      "policies": ["BucketFullAccess"],
      "attributes": {
            "verified": true,
            "role": "user",
      },
      "lastLogin": "2024-09-11T21:47:00.000Z",
      "failedAttempts": []
    },
    ...
}
```

#### 2. Get Single Identity

```http
GET /api/passport/identity/:id
Authorization: IDENTITY <jwt_token> OR APIKEY <api_key>
```

**Example:**

```bash
curl -H "Authorization: IDENTITY eyJhbGciOiJIUzI1NiIs..." \
  https://example.spica.com/api/passport/identity/60f7b1234567890abcdef123
```

#### 3. Create Identity

```http
POST /api/passport/identity
Authorization: IDENTITY <jwt_token> OR APIKEY <api_key>
Content-Type: application/json

{
  "identifier": "new_user",
  "password": "secure_password123",
  "attributes": {
    "name": "John Doe",
    "department": "Engineering"
  }
}
```

**Example with curl:**

```bash
curl -X POST \
  -H "Authorization: IDENTITY eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "developer",
    "password": "dev_password123",
    "attributes": {
      "role": "backend_developer",
      "team": "api_team"
    }
  }' \
  https://example.spica.com/api/passport/identity
```

#### 4. Update Identity

```http
PUT /api/passport/identity/:id
Authorization: IDENTITY <jwt_token> OR APIKEY <api_key>
Content-Type: application/json

{
  "identifier": "updated_user",
  "password": "new_password123",
  "attributes": {
    "name": "Jane Doe",
    "department": "DevOps"
  }
}
```

#### 5. Delete Identity

```http
DELETE /api/passport/identity/:id
Authorization: IDENTITY <jwt_token> OR APIKEY <api_key>
```

Note: The system prevents deletion of the last remaining identity to maintain system access.

#### 6. Login (Get JWT Token)

```http
POST /api/passport/identify
Content-Type: application/json

{
  "identifier": "admin",
  "password": "admin_password"
}
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "refresh_token_string"
}
```

#### 7. Verify Token

```http
GET /api/passport/identity/verify
Authorization: IDENTITY <jwt_token> OR APIKEY <api_key>
```

---

## API Keys

API Keys provide a secure way for applications and services to authenticate with the Spica API without using user credentials.

### API Key Schema

```json
{
  "_id": "ObjectId",
  "key": "string",
  "name": "string",
  "description": "string",
  "active": "boolean",
  "policies": ["string"]
}
```

### API Key Operations

#### 1. List API Keys

```http
GET /api/passport/apikey
Authorization: IDENTITY <jwt_token> OR APIKEY <api_key>
```

**Response:**

```json
{
  "meta": {
    "total": 1
  },
  "data": [
    {
      "_id": "60f7b1234567890abcdef456",
      "key": "spica_key_abc123def456",
      "name": "Production API Key",
      "description": "Key for production environment access",
      "active": true,
      "policies": ["BucketFullAccess", "FunctionReadOnlyAccess"]
    }
  ]
}
```

#### 2. Get Single API Key

```http
GET /api/passport/apikey/:id
Authorization: IDENTITY <jwt_token> OR APIKEY <api_key>
```

#### 3. Create API Key

```http
POST /api/passport/apikey
Authorization: IDENTITY <jwt_token> OR APIKEY <api_key>
Content-Type: application/json

{
  "name": "Mobile App Key",
  "description": "API key for mobile application",
  "active": true
}
```

**Example:**

```bash
curl -X POST \
  -H "Authorization: IDENTITY eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Analytics Service Key",
    "description": "Key for analytics microservice",
    "active": true
  }' \
  https://example.spica.com/api/passport/apikey
```

**Response:**

```json
{
  "_id": "60f7b1234567890abcdef789",
  "key": "spica_key_generated_unique_id",
  "name": "Analytics Service Key",
  "description": "Key for analytics microservice",
  "active": true,
  "policies": []
}
```

#### 4. Update API Key

```http
PUT /api/passport/apikey/:id
Authorization: IDENTITY <jwt_token> OR APIKEY <api_key>
Content-Type: application/json

{
  "name": "Updated Mobile App Key",
  "description": "Updated description",
  "active": false
}
```

Note: The `key` field cannot be updated through this endpoint for security reasons.

#### 5. Delete API Key

```http
DELETE /api/passport/apikey/:id
Authorization: IDENTITY <jwt_token> OR APIKEY <api_key>
```

---

## Policies

Policies define what actions can be performed on which resources. They use a statement-based access control model similar to AWS IAM policies.

### Policy Schema

```json
{
  "_id": "string",
  "name": "string",
  "description": "string",
  "statement": [
    {
      "action": "string",
      "module": "string",
      "resource": {
        "include": ["string"],
        "exclude": ["string"]
      }
    }
  ]
}
```

### Built-in Policies

Spica comes with several built-in policies:

- `PassportFullAccess`: Full access to all passport features
- `PassportReadOnlyAccess`: Read-only access to passport features
- `IdentityFullAccess`: Full access to identity management
- `IdentityReadOnlyAccess`: Read-only access to identities
- `ApiKeyFullAccess`: Full access to API key management
- `ApiKeyReadOnlyAccess`: Read-only access to API keys
- `PolicyFullAccess`: Full access to policy management
- `PolicyReadOnlyAccess`: Read-only access to policies
- `BucketFullAccess`: Full access to bucket operations
- `FunctionFullAccess`: Full access to function operations

### Policy Operations

#### 1. List Policies

```http
GET /api/passport/policy
Authorization: IDENTITY <jwt_token> OR APIKEY <api_key>
```

**Response:**

```json
{
  "meta": {
    "total": 1
  },
  "data": [
    {
      "_id": "BucketFullAccess",
      "name": "Bucket Full Access",
      "description": "Full access to bucket operations",
      "statement": [
        {
          "action": "bucket:index",
          "module": "bucket",
          "resource": {
            "include": ["*"],
            "exclude": []
          }
        },
        {
          "action": "bucket:show",
          "module": "bucket",
          "resource": {
            "include": ["*"],
            "exclude": []
          }
        },
        {
          "action": "bucket:create",
          "module": "bucket"
        },
        {
          "action": "bucket:update",
          "module": "bucket",
          "resource": {
            "include": ["*"],
            "exclude": []
          }
        },
        {
          "action": "bucket:delete",
          "module": "bucket",
          "resource": {
            "include": ["*"],
            "exclude": []
          }
        }
      ]
    }
  ]
}
```

#### 2. Get Single Policy

```http
GET /api/passport/policy/:id
Authorization: IDENTITY <jwt_token> OR APIKEY <api_key>
```

#### 3. Create Custom Policy

For creating a specific policies for specific resources use id values of that resource with the required actions

```http
POST /api/passport/policy
Authorization: IDENTITY <jwt_token> OR APIKEY <api_key>
Content-Type: application/json

{
  "name": "Custom Read Policy",
  "description": "Custom policy for read-only access to specific buckets",
  "statement": [
    {
      "action": "bucket:show",
      "module": "bucket",
      "resource": {
        "include": ["60f7b1234567890abcdef111", "60f7b1234567890abcdef222"],
        "exclude": []
      }
    },
    {
      "action": "bucket:data:index",
      "module": "bucket:data",
      "resource": {
        "include": ["60f7b1234567890abcdef111/*"],
        "exclude": []
      }
    }
  ]
}
```

#### 4. Update Policy

```http
PUT /api/passport/policy/:id
Authorization: IDENTITY <jwt_token> OR APIKEY <api_key>
Content-Type: application/json

{
  "name": "Updated Custom Policy",
  "description": "Updated description",
  "statement": [
    {
      "action": "bucket:index",
      "module": "bucket",
      "resource": {
        "include": ["*"],
        "exclude": ["60f7b1234567890abcdef333"]
      }
    }
  ]
}
```

#### 5. Delete Policy

```http
DELETE /api/passport/policy/:id
Authorization: IDENTITY <jwt_token> OR APIKEY <api_key>
```

---

## Authentication Methods

### 1. JWT IDENTITY Token Authentication

Used for user sessions and web applications:

```http
Authorization: IDENTITY eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZGVudGlmaWVyIjoiYWRtaW4iLCJpYXQiOjE2OTE4MjQ2MDAsImV4cCI6MTY5MTgyODIwMH0.signature
```

### 2. API Key Authentication

Used for service-to-service communication:

```http
Authorization: APIKEY spica_key_abc123def456
```

**Example API Call with API Key:**

```bash
curl -H "Authorization: APIKEY spica_key_abc123def456" \
  https://example.spica.com/api/bucket/60f7b1234567890abcdef123/data
```

---

## Policy Assignment

### Assign Policy to Identity

```http
PUT /api/passport/identity/:identityId/policy/:policyId
Authorization: IDENTITY <jwt_token> OR APIKEY <api_key>
```

**Example:**

```bash
curl -X PUT \
  -H "Authorization: IDENTITY eyJhbGciOiJIUzI1NiIs..." \
  https://example.spica.com/api/passport/identity/60f7b1234567890abcdef123/policy/BucketFullAccess
```

### Remove Policy from Identity

```http
DELETE /api/passport/identity/:identityId/policy/:policyId
Authorization: IDENTITY <jwt_token> OR APIKEY <api_key>
```

### Assign Policy to API Key

```http
PUT /api/passport/apikey/:apikeyId/policy/:policyId
Authorization: IDENTITY <jwt_token> OR APIKEY <api_key>
```

**Example:**

```bash
curl -X PUT \
  -H "Authorization: IDENTITY eyJhbGciOiJIUzI1NiIs..." \
  https://example.spica.com/api/passport/apikey/60f7b1234567890abcdef456/policy/FunctionReadOnlyAccess
```

### Remove Policy from API Key

```http
DELETE /api/passport/apikey/:apikeyId/policy/:policyId
Authorization: IDENTITY <jwt_token> OR APIKEY <api_key>
```

---

## API Examples

### Complete Workflow Example

Here's a complete workflow showing how to create a new user with specific permissions:

#### Step 1: Login as Admin

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "admin",
    "password": "admin_password"
  }' \
  https://example.spica.com/api/passport/identify
```

#### Step 2: Create New Identity

```bash
curl -X POST \
  -H "Authorization: IDENTITY <admin_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "api_user",
    "password": "secure_password123",
    "attributes": {
      "name": "API Service User",
      "purpose": "External API access"
    }
  }' \
  https://example.spica.com/api/passport/identity
```

#### Step 3: Create API Key for Service

```bash
curl -X POST \
  -H "Authorization: IDENTITY <admin_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "External Service Key",
    "description": "API key for external service integration",
    "active": true
  }' \
  https://example.spica.com/api/passport/apikey
```

#### Step 4: Assign Policies

```bash
# Assign bucket read access to identity
curl -X PUT \
  -H "Authorization: IDENTITY <admin_jwt_token>" \
  https://example.spica.com/api/passport/identity/<identity_id>/policy/BucketReadOnlyAccess

# Assign function access to API key
curl -X PUT \
  -H "Authorization: IDENTITY <admin_jwt_token>" \
  https://example.spica.com/api/passport/apikey/<apikey_id>/policy/FunctionFullAccess
```

#### Step 5: Test API Key Access

```bash
curl -H "Authorization: APIKEY <generated_api_key>" \
  https://example.spica.com/api/function
```

### Error Handling Examples

#### Unauthorized Access

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

#### Insufficient Permissions

```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

#### Invalid Credentials

```json
{
  "statusCode": 401,
  "message": "Identifier or password was incorrect.",
  "error": "Unauthorized"
}
```

---

## Schema Reference

### Identity Schema Validation

- `identifier`: Required, minimum 3 characters
- `password`: Required, minimum 3 characters (when creating)
- `attributes`: Optional object for custom data
- `policies`: Array of policy IDs (managed separately)

### API Key Schema Validation

- `name`: Required string
- `description`: Optional string
- `active`: Boolean, defaults to true
- `key`: Auto-generated, cannot be manually set

### Policy Schema Validation

- `name`: Required string
- `description`: Required string
- `statement`: Required array of statement objects

### Statement Schema

- `action`: Required string (e.g., "bucket:create", "function:index")
- `module`: Required string (e.g., "bucket", "function", "passport:identity")
- `resource`: Optional object with `include` and `exclude` arrays

### Resource Patterns

- `["*"]`: All resources
- `["specific_id"]`: Specific resource by ID
- `["pattern/*"]`: Resources matching pattern
- `["*"]` with `exclude`: All except excluded resources

---

## Security Best Practices

1. **API Key Management**:

   - Rotate API keys regularly
   - Use environment variables for API keys
   - Set API keys to inactive when not needed
   - Use least-privilege principle for policy assignment

2. **Identity Management**:

   - Use strong passwords (enforced by system)
   - Regular password updates
   - Monitor failed login attempts
   - Use JWT token expiration appropriately

3. **Policy Design**:

   - Create specific policies rather than using broad access
   - Regularly review and audit policy assignments
   - Use resource restrictions where possible
   - Document custom policies thoroughly

4. **Authentication**:
   - Use HTTPS for all API calls
   - Store JWT tokens securely
   - Implement proper token refresh mechanisms
   - Log authentication events for audit purposes
