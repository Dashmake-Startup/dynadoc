import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

export const changeFigureToImage = (
  editor: Editor,
  wrapperElement: HTMLElement
) => {
  const { state, view } = editor;
  const { tr } = state;
  const imageWrapperElement = document.createElement("div");
  const oldAttributes = wrapperElement.attributes;
  const newAttributes = imageWrapperElement.attributes;
  const imageWrapperPosition = view.posAtDOM(wrapperElement, 0);

  // Copy attributes
  for (let i = 0, len = oldAttributes.length; i < len; i++) {
    newAttributes.setNamedItem(oldAttributes.item(i).cloneNode() as Attr);
  }

  // Find the image within the old wrapper and set it as the only child of the new wrapper
  const imageElement = wrapperElement.querySelector("img");
  if (imageElement) {
    imageWrapperElement.appendChild(imageElement);
  }

  // Replace wrapperElement with imageWrapperElement
  wrapperElement.replaceWith(imageWrapperElement);

  // Focus on the newly replaced wrapper element
  const newSelection = TextSelection.create(tr.doc, imageWrapperPosition);
  const transaction = tr.setSelection(newSelection);
  view.dispatch(transaction);
};

export const changeImageToFigure = (
  editor: Editor,
  wrapperElement: HTMLElement,
  captionElement: HTMLElement
) => {
  const { state, view } = editor;
  const { tr } = state;
  const figureWrapperElement = document.createElement("figure");
  const oldAttributes = wrapperElement.attributes;
  const newAttributes = figureWrapperElement.attributes;
  const figureWrapperPosition = view.posAtDOM(wrapperElement, 0);

  // Copy attributes
  for (let i = 0, len = oldAttributes.length; i < len; i++) {
    newAttributes.setNamedItem(oldAttributes.item(i).cloneNode() as Attr);
  }

  // Find the image within the old wrapper and set it as the only child of the new wrapper
  const imageElement = wrapperElement.querySelector("img");
  if (imageElement) {
    figureWrapperElement.appendChild(imageElement);
  }
  captionElement.innerHTML = "Caption";
  figureWrapperElement.appendChild(captionElement);

  // Replace wrapperElement with figureWrapperElement
  wrapperElement.replaceWith(figureWrapperElement);

  // Focus on the newly replaced wrapper element
  const newSelection = TextSelection.create(tr.doc, figureWrapperPosition);
  const transaction = tr.setSelection(newSelection);
  view.dispatch(transaction);
};
