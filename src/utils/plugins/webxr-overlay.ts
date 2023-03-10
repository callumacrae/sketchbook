import type { SketchPlugin } from './interface';

export default class OverlayPlugin<CanvasState, UserConfig>
  implements SketchPlugin<CanvasState, UserConfig>
{
  readonly name = 'overlay';

  private element: HTMLDivElement | undefined;
  private warningElement: HTMLParagraphElement | undefined;
  private warning: { text: string; duration: 'frame' | 'forever' } | null =
    null;

  onBeforeFrame() {
    if (this.warning?.duration === 'frame') {
      this.warning = null;
    }
  }

  onFrame() {
    if (!this.warningElement) return;
    if (this.warning) {
      this.warningElement.textContent = this.warning.text;
      this.warningElement.style.display = 'block';
    } else {
      this.warningElement.style.display = 'none';
    }
  }

  onDispose() {
    if (this.element) {
      this.element.remove();
      this.element = undefined;
      this.warningElement = undefined;
    }
  }

  getRoot() {
    if (this.element) return this.element;

    const overlay = document.createElement('div');
    document.body.append(overlay);

    const overlayContent = document.createElement('div');
    overlayContent.style.width = '100%';
    overlayContent.style.height = '100%';
    overlayContent.style.display = 'flex';
    overlayContent.style.justifyContent = 'center';
    overlayContent.style.alignItems = 'center';
    overlay.appendChild(overlayContent);

    const overlayWarning = document.createElement('p');
    overlayWarning.style.color = 'red';
    overlayWarning.style.background = 'black';
    overlayWarning.style.padding = '7px 14px';
    overlayWarning.style.borderRadius = '4px';
    overlayWarning.style.display = 'none';
    overlayContent.appendChild(overlayWarning);
    this.warningElement = overlayWarning;

    this.element = overlay;
    return overlay;
  }

  showWarning(text: string, duration: 'frame' | 'forever' = 'frame') {
    this.warning = { text, duration };
  }

  hideWarning() {
    this.warning = null;
  }
}
