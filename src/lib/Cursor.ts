export enum CursorType {
  GRAB = 'grab',
  GRABBING = 'grabbing',
  POINTER = 'pointer',
  NS_RESIZE = 'ns-resize',
  DEFAULT = '',
}

export default class Cursor {
  private static targetElement: HTMLElement | null = null;
  private constructor() { }

  public static init(targetElement: HTMLElement) {
    Cursor.targetElement = targetElement;
  }

  public static set(cursorType: CursorType) {
    if (!Cursor.targetElement) {
      throw new Error('Cannot set cursor before initialization');
    }

    Cursor.targetElement.style.cursor = cursorType;
  }
}
