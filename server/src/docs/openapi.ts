import { env } from '../config/env.js';

/**
 * Hand-maintained OpenAPI 3 skeleton. It documents the shape of the API
 * (auth, resources, the standard list envelope and error body). Detailed
 * per-field schemas are added incrementally alongside each module.
 */
export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'MLA File Management System API',
    version: '0.1.0',
    description:
      'REST API for constituency request, file and document management. ' +
      'All endpoints except /auth/login, /auth/refresh, /setup/status, /setup/bootstrap and ' +
      '/documents/raw require a Bearer access token.',
  },
  servers: [{ url: `${env.BACKEND_URL}/api` }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          code: { type: 'string' },
          details: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } },
          requestId: { type: 'string' },
        },
      },
      Paginated: {
        type: 'object',
        properties: {
          data: { type: 'array', items: {} },
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['usernameOrEmail', 'password'],
        properties: { usernameOrEmail: { type: 'string' }, password: { type: 'string', format: 'password' } },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': { get: { summary: 'Health check', security: [], responses: { 200: { description: 'ok' } } } },
    '/setup/status': { get: { summary: 'First-run status', security: [], responses: { 200: { description: 'status' } } } },
    '/setup/bootstrap': { post: { summary: 'Create first Super Admin', security: [], responses: { 200: { description: 'done' }, 409: { description: 'already set up' } } } },
    '/auth/login': {
      post: {
        summary: 'Login',
        security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
        responses: { 200: { description: 'access token + user' }, 401: { description: 'invalid credentials' } },
      },
    },
    '/auth/refresh': { post: { summary: 'Rotate access token from refresh cookie', security: [], responses: { 200: { description: 'ok' } } } },
    '/auth/me': { get: { summary: 'Current user', responses: { 200: { description: 'user' } } } },
    '/dashboard/stats': { get: { summary: 'Live dashboard counters', responses: { 200: { description: 'DashboardStats' } } } },
    '/requests': {
      get: { summary: 'List requests (paginated, filterable)', responses: { 200: { description: 'Paginated<Request>' } } },
      post: { summary: 'Create request / draft', responses: { 201: { description: 'Request' } } },
    },
    '/requests/{id}': { get: { summary: 'Request detail', responses: { 200: { description: 'Request' }, 404: { description: 'not found' } } } },
    '/requests/{id}/status': { post: { summary: 'Change workflow status', responses: { 200: { description: 'Request' }, 409: { description: 'illegal transition' } } } },
    '/requests/{id}/assign': { post: { summary: 'Assign to department/officer', responses: { 200: { description: 'Request' } } } },
    '/requests/{id}/forward': { post: { summary: 'Forward to another department', responses: { 200: { description: 'Request' } } } },
    '/letters': {
      get: { summary: 'List MLA letters (paginated, filterable)', responses: { 200: { description: 'Paginated<Letter>' } } },
      post: { summary: 'Create an MLA letter', responses: { 201: { description: 'Letter' } } },
    },
    '/letters/{id}': { get: { summary: 'Letter detail', responses: { 200: { description: 'Letter' } } } },
    '/letters/{id}/status': { post: { summary: 'Set letter status (DRAFT|ISSUED|DISPATCHED|REPLIED|CLOSED)', responses: { 200: { description: 'Letter' } } } },
    '/documents/request/{requestId}': {
      get: { summary: 'List request documents', responses: { 200: { description: 'Document[]' } } },
      post: { summary: 'Upload one or more documents (multipart)', responses: { 201: { description: 'Document[]' } } },
    },
    '/documents/letter/{letterId}': {
      get: { summary: 'List letter documents', responses: { 200: { description: 'Document[]' } } },
      post: { summary: 'Upload letter documents (multipart)', responses: { 201: { description: 'Document[]' } } },
    },
    '/documents/{id}/url': { get: { summary: 'Short-lived signed URL', responses: { 200: { description: 'signed url' } } } },
    '/reports/{key}': { get: { summary: 'Report data or export (?format=csv|xlsx|pdf)', responses: { 200: { description: 'report' } } } },
    '/audit-logs': { get: { summary: 'Search the audit trail', responses: { 200: { description: 'Paginated<AuditLog>' } } } },
  },
} as const;
