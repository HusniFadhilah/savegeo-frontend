/**
 * Leaflet renders string tooltip/popup content as HTML. Wrap text that comes
 * from APIs, geocoders or the assistant in a text node so markup in it is
 * displayed literally instead of being executed.
 */
export function plainTextContent(text: string): HTMLElement {
  const element = document.createElement("span");
  element.textContent = text;
  return element;
}
