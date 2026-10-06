// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Field Highlighter
// Non-intrusive on-page visual outlines and legend for mapped fields
// ─────────────────────────────────────────────────

import type { FieldMapping } from '@shared/types';
import { resolveElement } from './form-scanner';

export class FieldHighlighter {
  private static overlayContainerId = 'sevapilot-highlight-legend';
  private static highlightedElements: HTMLElement[] = [];

  /**
   * Apply subtle outlines and badge annotations to detected fields on the active page
   */
  public static highlight(mappings: FieldMapping[], doc: Document = document): void {
    this.clear(doc);

    for (const mapping of mappings) {
      if (!mapping.pilgrimKey) continue;

      const element = resolveElement(mapping.scannedField.element, doc);
      if (!element) continue;

      // Determine outline color based on field status
      const isComplete = mapping.confidence >= 70;
      const borderColor = isComplete ? '#2E7D5B' : '#D4A72C'; // Temple green or Temple gold
      const tagBg = isComplete ? '#E8F5E9' : '#FFF8E8';
      const tagColor = isComplete ? '#1B5E20' : '#8D6E18';

      // Set subtle outline
      element.dataset.sevapilotHighlighted = 'true';
      element.style.outline = `2px solid ${borderColor}`;
      element.style.outlineOffset = '2px';
      element.style.borderRadius = '4px';
      element.style.transition = 'outline 0.2s ease';

      // Insert small indicator tag above or adjacent to element if not already present
      const parent = element.parentElement;
      if (parent && !parent.querySelector('.sp-field-tag')) {
        const tag = doc.createElement('span');
        tag.className = 'sp-field-tag';
        tag.textContent = `✓ ${mapping.pilgrimKey}`;
        tag.style.cssText = `
          display: inline-block;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 10px;
          font-weight: 600;
          color: ${tagColor};
          background: ${tagBg};
          border: 1px solid ${borderColor};
          border-radius: 4px;
          padding: 1px 5px;
          margin-bottom: 2px;
          vertical-align: middle;
          pointer-events: none;
        `;
        parent.insertBefore(tag, element);
      }

      this.highlightedElements.push(element);
    }

    this.renderLegend(doc);
  }

  /**
   * Clear all highlights and legend
   */
  public static clear(doc: Document = document): void {
    // Remove outlines
    for (const el of this.highlightedElements) {
      el.style.outline = '';
      el.style.outlineOffset = '';
      delete el.dataset.sevapilotHighlighted;
    }
    this.highlightedElements = [];

    // Remove field tags
    const tags = doc.querySelectorAll('.sp-field-tag');
    tags.forEach(t => t.remove());

    // Remove legend
    const legend = doc.getElementById(this.overlayContainerId);
    if (legend) legend.remove();
  }

  /**
   * Render floating legend in bottom-right corner
   */
  private static renderLegend(doc: Document): void {
    const existing = doc.getElementById(this.overlayContainerId);
    if (existing) existing.remove();

    const legend = doc.createElement('div');
    legend.id = this.overlayContainerId;
    legend.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483640;
      background: #FFFDF7;
      border: 1.5px solid #D4A72C;
      border-radius: 10px;
      padding: 10px 14px;
      box-shadow: 0 4px 16px rgba(91, 42, 134, 0.15);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 12px;
      color: #321B3F;
      display: flex;
      flex-direction: column;
      gap: 6px;
    `;

    legend.innerHTML = `
      <div style="font-weight: 700; color: #5B2A86; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <span>🛕 SevaPilot Field Highlights</span>
        <button id="sp-close-legend" style="background:none; border:none; cursor:pointer; font-size:12px; color:#8B7D8F;">✕</button>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="display:inline-block; width:10px; height:10px; background:#2E7D5B; border-radius:2px;"></span>
        <span>High Confidence Match</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="display:inline-block; width:10px; height:10px; background:#D4A72C; border-radius:2px;"></span>
        <span>Standard Match / Disambiguated</span>
      </div>
    `;

    doc.body.appendChild(legend);

    const closeBtn = legend.querySelector('#sp-close-legend');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.clear(doc));
    }
  }
}
