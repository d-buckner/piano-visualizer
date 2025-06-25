import containerStyle from '../containerStyle';

const PREFIX = 'pviz_';

export default function applyStyle(): string {
  const id = getPrefixedShortId();
  const style = document.createElement('style');
  style.textContent = getContent(id);
  document.head.append(style);
  return id;
}


function getContent(id: string): string {
  return `#${id} {${containerStyle}}`;
}

function getPrefixedShortId(): string {
  const randomBuffers = crypto.getRandomValues(new Uint32Array(1));
  const shortId = [...randomBuffers].reduce((acc, buf) => acc = buf.toString(36), '');
  return PREFIX + shortId;
}
