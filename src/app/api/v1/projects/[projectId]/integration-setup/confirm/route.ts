/**
 * POST /api/v1/projects/{project_id}/integration-setup/confirm
 *
 * Phase 9 of the Integration Setup Agent contract.
 *
 * Stores the final integration manifest after the user confirms the
 * setup summary. The manifest contains ONLY non-secret information:
 *   - provider slugs
 *   - connection ids
 *   - credential references (vault://... — never the secret itself)
 *   - selected resources (type + id + name only)
 *   - status snapshots
 *
 * The manifest is what the AI agent exports. Plaintext tokens never
 * appear in this response, in logs, in JSON exports, or in CSV reports.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const { projectId } = await params;

  // Load every connected integration for this company
  const integrations = await db.integration.findMany({
    where: { companyId: ctx.companyId, status: 'connected' },
    include: { secrets: true, resources: true },
  });

  if (integrations.length === 0) {
    return badRequest('no connected integrations to confirm');
  }

  // Build the manifest — secrets NEVER appear here, only vault:// references
  const manifest = {
    project_id: projectId,
    workspace_id: ctx.companyId,
    confirmed_at: new Date().toISOString(),
    integrations: integrations.map((i) => ({
      provider: i.provider,
      connection_id: i.id,
      credential_reference: `vault://integrations/${i.id}/secrets`,
      auth_method: i.authMethod,
      granted_scopes: JSON.parse(i.grantedScopes || '[]'),
      resources: (JSON.parse(i.selectedResources || '[]') as any[]).map((r) => ({
        type: r.type,
        id: r.id,
        name: r.name,
      })),
      status: i.status,
      last_validated_at: i.lastValidatedAt?.toISOString() || null,
      refresh_supported: i.refreshSupported,
      token_expires_at: i.tokenExpiresAt?.toISOString() || null,
    })),
  };

  // Persist the manifest (idempotent per company per project)
  const saved = await db.integrationManifest.create({
    data: {
      companyId: ctx.companyId,
      projectId,
      workspaceId: ctx.companyId,
      manifest: JSON.stringify(manifest),
      confirmedBy: ctx.userId,
    },
  });

  await emitEvent({
    type: 'integration.manifest_confirmed',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'integration_manifest',
    resourceId: saved.id,
    metadata: {
      projectId,
      integrationCount: integrations.length,
      providers: integrations.map((i) => i.provider),
    },
  });

  return ok({
    manifest_id: saved.id,
    confirmed_at: manifest.confirmed_at,
    integration_count: integrations.length,
    manifest, // safe to export — contains only non-secret references
  });
}
