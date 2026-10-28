/**
 * Copyright (C) 2024 Dashmake Inc.
 *
 * This file is part of DDoc Office.
 *
 * DDoc Office is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * DDoc Office is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.
 */
import { writable, type Writable } from 'svelte/store'

// Import all themes from the themes folder
/*   async function importThemes(): Promise<{ [key: string]: any }> {
    const modules = import.meta.glob('./themes/*.ts');
    const themes: { [key: string]: any } = {};

    for (const path in modules) {
      const module = await modules[path]();
      const themeName = path.match(/\/([^/]+)\.ts$/)[1];
      themes[themeName] = module.default;
    }

    return themes;
  } */

// Define themes
const themes = {
  default: {
    '--primary-color': '#3498db',
    '--secondary-color': '#2ecc71',
    '--text-color': '#ffffff',
    '--background-color': '#34495e'
  },
  red: {
    '--primary-color': '#e74c3c',
    '--secondary-color': '#8e44ad',
    '--text-color': '#ffffff',
    '--background-color': '#2c3e50'
  },
  blue: {
    '--primary-color': '#2980b9',
    '--secondary-color': '#16a085',
    '--text-color': '#ffffff',
    '--background-color': '#2c3e50'
  }
}

// class ThemeManager {
export default class ThemeManager {
  private currentTheme: Writable<string>
  private themes: object

  constructor() {
    this.currentTheme = writable('default') // Set current theme to default
    this.themes = themes

    // Initialize with the default theme
    this.currentTheme.subscribe((themeName) => this.applyTheme(this.themes[themeName]))
  }

  public changeTheme(themeName: string): void {
    this.currentTheme.set(themeName)
    this.applyTheme(this.themes[themeName])
  }

  private applyTheme(theme: object): void {
    Object.keys(theme).forEach((key) => {
      document.documentElement.style.setProperty(key, theme[key])
    })
  }
}

// const themeManager = new ThemeManager()

// export default themeManager

/*

<script lang="ts">
  import { writable } from 'svelte/store';

  // Import all themes from the themes folder
  async function importThemes(): Promise<{ [key: string]: any }> {
    const modules = import.meta.glob('./themes/*.ts');
    const themes: { [key: string]: any } = {};

    for (const path in modules) {
      const module = await modules[path]();
      const themeName = path.match(/\/([^/]+)\.ts$/)[1];
      themes[themeName] = module.default;
    }

    return themes;
  }

  // Initialize themes and current theme store
  let themes: { [key: string]: any } = {};
  const currentTheme = writable<string>('default');

  // Function to update the theme
  function changeTheme(themeName: string) {
    currentTheme.set(themeName);
    applyTheme(themes[themeName]);
  }

  // Apply theme function
  function applyTheme(theme: { [key: string]: string }) {
    Object.keys(theme).forEach((key) => {
      document.documentElement.style.setProperty(key, theme[key]);
    });
  }

  // Load themes on component mount
  importThemes().then(loadedThemes => {
    themes = loadedThemes;
    currentTheme.subscribe((themeName) => applyTheme(themes[themeName]));
  });
</script>

<style>
  .themed-element {
    background-color: var(--primary-color);
    color: var(--text-color);
    padding: 10px;
    margin: 10px;
    border: 1px solid var(--secondary-color);
  }

  .themed-element.secondary {
    background-color: var(--secondary-color);
    color: var(--text-color);
  }
</style>

<div class="themed-element">
  Primary Themed Element
</div>
<div class="themed-element secondary">
  Secondary Themed Element
</div>

<button on:click={() => changeTheme('default')}>
  Default Theme
</button>
<button on:click={() => changeTheme('red')}>
  Red Theme
</button>
<button on:click={() => changeTheme('blue')}>
  Blue Theme
</button>

*/
