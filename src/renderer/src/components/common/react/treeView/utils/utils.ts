import { mount, unmount, type ComponentType } from "svelte"

export function mountSvelteComponent(
    Component: ComponentType,
    props?: Record<string, any>,
    parent: HTMLElement = document.body
) {
    const container = document.createElement("span")
    container.style.position = `fixed`
    container.style.left = `${props.__x}px`
    container.style.top = `${props.__y}px`
    parent.appendChild(container)

    let instance = mount(Component, {
        target: container,
        props: { ...props, __setPosition: false }
    })

    // const instance = new Component({
    //     target: container,
    //     props
    // })

    document.addEventListener("click", () => {
        if (instance) unmount(instance)
        instance = null
        // instance.$destroy()
        container.remove()
    })


    return {
        destroy() {
            if (instance) unmount(instance)
            instance = null
            // instance.$destroy()
            container.remove()
        },
        instance,
        el: container
    }
}
