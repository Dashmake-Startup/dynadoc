import { gsap } from 'gsap';


export function snapshotKonva(root: HTMLElement) {
  root.querySelectorAll('.konvajs-content canvas').forEach(canvas => {
    const img = document.createElement('img');
    img.src = canvas.toDataURL('image/png');
    img.style.width = canvas.style.width;
    img.style.height = canvas.style.height;
    canvas.replaceWith(img);
  });
}


export function animateSlideIn(el: HTMLElement) {
  gsap.fromTo(
    el,
    { opacity: 0, scale: 0.98 },
    { opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out' }
  );
}

export function animateSlideOut(el: HTMLElement) {
  gsap.to(el, {
    opacity: 0,
    scale: 1.02,
    duration: 0.4,
    ease: 'power2.in'
  });
}

export function getMapEntryAtIndex<K, V>(map: Map<K, V>, index: number): [K, V] | undefined {
  return Array.from(map.entries())[index]
}
