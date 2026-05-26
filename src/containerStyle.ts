/**
 * CSS layer of iOS text-selection prevention (defense-in-depth layer 1 of 3).
 *
 * - user-select / -webkit-user-select: none — disables CSS-driven text selection.
 * - -webkit-touch-callout: none — suppresses the iOS long-press callout/share sheet.
 * - touch-action: none — tells the browser not to handle any touch gestures itself
 *   (pan, pinch-zoom, double-tap-zoom), giving full control to our JS handlers.
 *
 * Layers 2 & 3 (TouchEvent.preventDefault and selectstart/contextmenu listeners)
 * are applied in VisualizationController.ts.
 */
const containerStyle = `
  overflow: hidden;
  overscroll-behavior-x: none;
  user-select: none;
  touch-action: none;
  -webkit-touch-callout: none;
  -webkit-text-size-adjust: none;
  -webkit-user-select: none;
  position: absolute;
  width: 100%;
  height: 100%;
`;

export default containerStyle;