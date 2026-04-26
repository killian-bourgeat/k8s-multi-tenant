import { Injectable } from '@nestjs/common';
import * as yaml from 'js-yaml';
import type { K8sManifest } from '../core/types.js';

/**
 * Lightweight YAML template engine for Kubernetes manifests.
 *
 * Substitutes `${VAR_NAME}` placeholders inside a YAML string before parsing.
 * Designed for the common SaaS use case of templating per-tenant manifests
 * without pulling in Helm or a full templating engine.
 */
@Injectable()
export class K8sTemplateEngine {
  /**
   * Render a YAML template string with the given variables and parse it.
   * Returns one or more parsed manifests (`yaml.loadAll`).
   */
  render(template: string, variables: Record<string, string>): K8sManifest[] {
    const rendered = this.substitute(template, variables);
    return yaml.loadAll(rendered) as K8sManifest[];
  }

  /** Substitute `${VAR}` placeholders in a string without parsing it as YAML. */
  substitute(template: string, variables: Record<string, string>): string {
    let output = template;
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\$\\{${this.escapeRegex(key)}\\}`, 'g');
      output = output.replace(pattern, String(value));
    }
    return output;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
