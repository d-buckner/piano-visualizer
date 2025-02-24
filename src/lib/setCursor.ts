export enum Cursor {
  GRAB = 'grab',
  GRABBING = 'grabbing',
  POINTER = 'pointer',
  NS_RESIZE = 'ns-resize',
  DEFAULT = '',
}

export default function setCursor(cursor: Cursor) {
  document.body.style.cursor = cursor;
}
