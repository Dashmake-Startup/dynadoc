import closedCaptionAddIcon from "../assets/icons/closed-caption-add.svg";
import deleteIcon from "../assets/icons/delete.svg";

export const addCaptionControls = (
  wrapperElement: HTMLElement,
  styles: Record<string, string>,
  onCaptionRemove: () => void,
  onCaptionAdd: () => void
) => {
  const captionControlsContainer = document.createElement("div");
  captionControlsContainer.setAttribute("contenteditable", "false");
  captionControlsContainer.setAttribute(
    "class",
    styles["caption-controls-element"]
  );

  // If wrapper element is a figure and the button doesn't already exist, add a button to remove caption
  // Also, wrapper elements needs to become a div
  if (
    wrapperElement.tagName === "FIGURE" &&
    !wrapperElement.querySelector(styles["remove-caption-button"])
  ) {
    const removeCaptionButton = document.createElement("img");
    removeCaptionButton.src = deleteIcon;
    removeCaptionButton.setAttribute("class", styles["remove-caption-button"]);
    removeCaptionButton.addEventListener("click", (event) => {
      event.stopPropagation();
      onCaptionRemove();
    });
    captionControlsContainer.appendChild(removeCaptionButton);
    wrapperElement.appendChild(captionControlsContainer);

    return;
  }

  // If wrapper element is a div and the button doesn't already exist, add a button to add caption
  if (
    wrapperElement.tagName === "DIV" &&
    !wrapperElement.querySelector(styles["add-caption-button"])
  ) {
    const addCaptionButton = document.createElement("img");
    addCaptionButton.src = closedCaptionAddIcon;
    addCaptionButton.setAttribute("class", styles["add-caption-button"]);
    addCaptionButton.addEventListener("click", (event) => {
      event.stopPropagation();
      onCaptionAdd();
    });
    captionControlsContainer.appendChild(addCaptionButton);
    wrapperElement.appendChild(captionControlsContainer);
  }
};
