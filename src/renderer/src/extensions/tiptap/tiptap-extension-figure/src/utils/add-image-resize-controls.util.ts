import { isMobileScreen } from "./is-mobile-screen.util";

export const addImageResizeControls = (
  wrapperElement: HTMLElement,
  imageElement: HTMLImageElement,
  isResizing: boolean,
  startX: number,
  startWidth: number,
  styles: Record<string, string>,
  onResize: () => void
) => {
  const isMobile = isMobileScreen();
  const dotPosition = isMobile ? "-8px" : "-4px";
  const dotSize = isMobile ? 16 : 9;
  const dotsPosition = [
    `top: ${dotPosition}; left: ${dotPosition}; cursor: nwse-resize;`,
    `top: ${dotPosition}; right: ${dotPosition}; cursor: nesw-resize;`,
    `bottom: ${dotPosition}; left: ${dotPosition}; cursor: nesw-resize;`,
    `bottom: ${dotPosition}; right: ${dotPosition}; cursor: nwse-resize;`,
  ];

  Array.from({ length: 4 }, (_, index) => {
    const dotElement = document.createElement("div");
    dotElement.setAttribute("class", styles["dot-element"]);
    dotElement.setAttribute(
      "style",
      `width: ${dotSize}px; height: ${dotSize}px; ${dotsPosition[index]}`
    );

    dotElement.addEventListener("mousedown", (e) => {
      e.preventDefault();
      isResizing = true;
      startX = e.clientX;
      startWidth = wrapperElement.offsetWidth;

      const onMouseMove = (event: MouseEvent) => {
        if (!isResizing) {
          return;
        }

        const deltaX =
          index % 2 === 0 ? -(event.clientX - startX) : event.clientX - startX;

        const newWidth = startWidth + deltaX;
        wrapperElement.style.width = newWidth + "px";
        imageElement.style.width = newWidth + "px";
      };

      const onMouseUp = () => {
        if (isResizing) {
          isResizing = false;
        }

        onResize();

        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });

    dotElement.addEventListener(
      "touchstart",
      (e) => {
        e.cancelable && e.preventDefault();
        isResizing = true;
        startX = e.touches[0].clientX;
        startWidth = wrapperElement.offsetWidth;

        const onTouchMove = (e: TouchEvent) => {
          if (!isResizing) return;

          const deltaX =
            index % 2 === 0
              ? -(e.touches[0].clientX - startX)
              : e.touches[0].clientX - startX;

          const newWidth = startWidth + deltaX;
          wrapperElement.style.width = newWidth + "px";
          imageElement.style.width = newWidth + "px";
        };

        const onTouchEnd = () => {
          if (isResizing) {
            isResizing = false;
          }

          onResize();

          document.removeEventListener("touchmove", onTouchMove);
          document.removeEventListener("touchend", onTouchEnd);
        };

        document.addEventListener("touchmove", onTouchMove);
        document.addEventListener("touchend", onTouchEnd);
      },
      { passive: false }
    );

    wrapperElement.appendChild(dotElement);
  });
};
