export const removeImageControlsAndResetStyles = (
  clickedElement: HTMLElement,
  wrapperElement: HTMLElement,
  styles: Record<string, string>
) => {
  const containerContainsClickedElement =
    wrapperElement.contains(clickedElement);

  if (containerContainsClickedElement) {
    return;
  }

  // Remove all custom UI elements and styling
  wrapperElement.classList.remove(styles["active"]);

  const children = Array.from(wrapperElement.children);
  children.forEach((child) => {
    if (child.tagName !== "IMG" && child.tagName !== "FIGCAPTION") {
      wrapperElement.removeChild(child);
    }
  });
};
