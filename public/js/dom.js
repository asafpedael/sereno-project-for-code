// Small DOM helpers. Text is always set with textContent, never as HTML.

// el('span', { className: 'x', attrs: { 'aria-pressed': 'false' } }, 'text', childNode)
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  if (props.className) node.className = props.className;
  if (props.attrs) {
    for (const [name, value] of Object.entries(props.attrs)) node.setAttribute(name, value);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node) {
  node.replaceChildren();
}
