/**
 * Kubernetes API group/version/plural triplets used with the
 * `CustomObjectsApi`. Centralized here so they don't drift between services.
 */

export const NETWORKING_API = {
  group: 'networking.k8s.io',
  version: 'v1',
  plural: {
    ingresses: 'ingresses',
  },
} as const;

export const CERT_MANAGER_API = {
  group: 'cert-manager.io',
  version: 'v1',
  plural: {
    certificates: 'certificates',
  },
} as const;

/**
 * Content-Type required by the Kubernetes API server when sending a
 * JSON Patch (RFC 6902) — the format we use to update specific fields
 * of an existing resource without replacing it entirely.
 */
export const JSON_PATCH_CONTENT_TYPE = 'application/json-patch+json';
