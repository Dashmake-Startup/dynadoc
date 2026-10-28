/* import App from './test.svelte';

const app = new App({
    target: document.getElementById('app'),
});

export default app; */

import { mount } from 'svelte';
import App from "./test.svelte"

// new App({target:document.querySelector("#app")})
mount(App, { target: document.querySelector("#app") });