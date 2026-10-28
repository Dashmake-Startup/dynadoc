
// Define the missing Chromium-specific constraints
export interface ExtendedMediaTrackConstraints extends MediaTrackConstraints {
  mandatory?: {
    chromeMediaSource?: string;
    chromeMediaSourceId?: string;
    [key: string]: any;
  };
}

export interface ExtendedMediaStreamConstraints extends MediaStreamConstraints {
  audio?: boolean | ExtendedMediaTrackConstraints;
  video?: boolean | ExtendedMediaTrackConstraints;
}

// interface DragParams {
//   isMinimized: boolean;
//   onDragStart?: () => void;
// }

// export function drag1(node: HTMLElement, { isMinimized }: { isMinimized: boolean }) {
//   let x = 0;
//   let y = 0;
//   const snapThreshold = 100; // Pixels from corner to trigger snap

//   const handleMousedown = (e: MouseEvent) => {

//     if (!isMinimized || !(e.target as HTMLElement).closest('.drag-handle')) return;

//     x = e.clientX;
//     y = e.clientY;

//     node.style.transition = 'none'; // Disable transitions during active drag
//     window.addEventListener('mousemove', handleMousemove);
//     window.addEventListener('mouseup', handleMouseup);
//   };

//   const handleMousemove = (e: MouseEvent) => {
//     const dx = e.clientX - x;
//     const dy = e.clientY - y;
//     x = e.clientX;
//     y = e.clientY;

//     node.style.transform = `translate3d(${node.offsetLeft + dx}px, ${node.offsetTop + dy}px, 0)`;
//     node.style.top = '0px';
//     node.style.left = '0px';
//   };

//   const handleMouseup = () => {
//     window.removeEventListener('mousemove', handleMousemove);
//     window.removeEventListener('mouseup', handleMouseup);

//     // --- AUTO DOCK LOGIC ---
//     const rect = node.getBoundingClientRect();
//     const winW = window.innerWidth;
//     const winH = window.innerHeight;

//     // Calculate distances to edges
//     const distLeft = rect.left;
//     const distRight = winW - rect.right;
//     const distTop = rect.top;
//     const distBottom = winH - rect.bottom;

//     // Determine target corner
//     let finalX = distLeft < distRight ? 24 : winW - rect.width - 24;
//     let finalY = distTop < distBottom ? 24 : winH - rect.height - 24;

//     // Re-enable transition for the snap effect
//     node.style.transition = 'transform 0.5s cubic-bezier(0.19, 1, 0.22, 1)';
//     node.style.transform = `translate3d(${finalX}px, ${finalY}px, 0)`;
//   };

//   node.addEventListener('mousedown', handleMousedown);

//   return {
//     destroy() {
//       node.removeEventListener('mousedown', handleMousedown);
//     }
//   };
// }

// export function dragMinimizedWindow(node: HTMLElement, params: DragParams) {
//   let x = 0;
//   let y = 0;
//   let translateX = 0;
//   let translateY = 0;

//   const handleMousedown = (e: MouseEvent) => {
//     if (!params.isMinimized || !(e.target as HTMLElement).closest('.drag-handle')) return;

//     e.preventDefault();
//     params.onDragStart?.(); // Notify Svelte that manual dragging has begun

//     // Sync current position
//     const style = window.getComputedStyle(node);
//     const matrix = new DOMMatrixReadOnly(style.transform);
//     translateX = matrix.m41;
//     translateY = matrix.m42;

//     x = e.clientX;
//     y = e.clientY;

//     node.style.transition = 'none';
//     window.addEventListener('mousemove', handleMousemove);
//     window.addEventListener('mouseup', handleMouseup);
//   };

//   const handleMousemove = (e: MouseEvent) => {
//     const dx = e.clientX - x;
//     const dy = e.clientY - y;

//     translateX += dx;
//     translateY += dy;

//     x = e.clientX;
//     y = e.clientY;

//     node.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
//   };

//   const handleMouseup = () => {
//     window.removeEventListener('mousemove', handleMousemove);
//     window.removeEventListener('mouseup', handleMouseup);

//     const rect = node.getBoundingClientRect();
//     const winW = window.innerWidth;
//     const winH = window.innerHeight;

//     // Corner Snapping Logic
//     const distLeft = rect.left;
//     const distRight = winW - rect.right;
//     const distTop = rect.top;
//     const distBottom = winH - rect.bottom;

//     // Adjust translateX/Y for 24px padding snaps
//     if (distLeft < distRight) translateX -= (distLeft - 24);
//     else translateX += (distRight - 24);

//     if (distTop < distBottom) translateY -= (distTop - 24);
//     else translateY += (distBottom - 24);

//     node.style.transition = 'transform 0.5s cubic-bezier(0.19, 1, 0.22, 1)';
//     node.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
//   };

//   node.addEventListener('mousedown', handleMousedown);

//   return {
//     update(newParams: DragParams) {
//       params = newParams;
//       // If we go back to full screen, clear the inline transform
//       if (!params.isMinimized) {
//         node.style.transform = '';
//       }
//     },
//     destroy() {
//       node.removeEventListener('mousedown', handleMousedown);
//     }
//   };
// }
// export function drag2(node: HTMLElement, params: { isMinimized: boolean }) {
//   let x = 0;
//   let y = 0;
//   let translateX = 0;
//   let translateY = 0;

//   const handleMousedown = (e: MouseEvent) => {
//     // 1. Critical: Check the LATEST isMinimized value from params
//     if (!params.isMinimized || !(e.target as HTMLElement).closest('.drag-handle')) return;

//     // Prevent text selection while dragging
//     e.preventDefault();

//     // Get the current transform values so we don't "jump" back to 0,0
//     const style = window.getComputedStyle(node);
//     const matrix = new DOMMatrixReadOnly(style.transform);
//     translateX = matrix.m41;
//     translateY = matrix.m42;

//     x = e.clientX;
//     y = e.clientY;

//     node.style.transition = 'none';
//     window.addEventListener('mousemove', handleMousemove);
//     window.addEventListener('mouseup', handleMouseup);
//   };

//   const handleMousemove = (e: MouseEvent) => {
//     const dx = e.clientX - x;
//     const dy = e.clientY - y;

//     translateX += dx;
//     translateY += dy;

//     x = e.clientX;
//     y = e.clientY;

//     node.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
//   };

//   const handleMouseup = () => {
//     window.removeEventListener('mousemove', handleMousemove);
//     window.removeEventListener('mouseup', handleMouseup);

//     const rect = node.getBoundingClientRect();
//     const winW = window.innerWidth;
//     const winH = window.innerHeight;

//     // Calculate snap targets (24px padding from edges)
//     // We calculate where the translate3d should go to land in a corner
//     const distLeft = rect.left;
//     const distRight = winW - rect.right;
//     const distTop = rect.top;
//     const distBottom = winH - rect.bottom;

//     // Logic to update translateX/Y based on snap
//     if (distLeft < distRight) translateX -= (distLeft - 24);
//     else translateX += (distRight - 24);

//     if (distTop < distBottom) translateY -= (distTop - 24);
//     else translateY += (distBottom - 24);

//     node.style.transition = 'transform 0.5s cubic-bezier(0.19, 1, 0.22, 1)';
//     node.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
//   };

//   node.addEventListener('mousedown', handleMousedown);

//   return {
//     // Svelte 5: update is called when params change
//     update(newParams: { isMinimized: boolean }) {
//       params = newParams;
//       if (!params.isMinimized) {
//         node.style.transform = ''; // Reset transform when going full screen
//       }
//     },
//     destroy() {
//       node.removeEventListener('mousedown', handleMousedown);
//     }
//   };
// }