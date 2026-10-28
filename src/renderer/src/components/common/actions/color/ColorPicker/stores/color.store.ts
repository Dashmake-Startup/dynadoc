import { persisted } from 'svelte-persisted-store';
import { derived } from 'svelte/store';

// Define the structure for our color management
export interface AppColorState {
  // Current active colors in the editor selection
  selection: {
    text: string;
    highlight: string;
    background: string;
  };
  // History of colors picked by the user
  history: string[];
  // Standard "Office" style presets
  presets: string[];
  // User defined custom "Favorite" colors
  favorites: string[];
}

const DEFAULT_PRESETS = [
  '#000000', '#FFFFFF', '#EE2424', '#2462EE', '#24EE5E', 
  '#F3EE24', '#EE24EE', '#24EEEE', '#8B4513', '#FFA500'
];

export const colorStore = persisted<AppColorState>('app_color_manager', {
  selection: {
    text: '#000000',
    highlight: 'transparent',
    background: 'transparent',
  },
  history: [],
  presets: DEFAULT_PRESETS,
  favorites: []
});

// Helper Functions
export const colorActions = {
  /** Update the color for a specific mode and add to history */
  setColor: (mode: 'text' | 'highlight' | 'background', hex: string) => {
    colorStore.update(s => {
      // 1. Update the active selection
      s.selection[mode] = hex;

      // 2. Add to history if it's a real color and not already there
      if (hex !== 'transparent' && !s.history.includes(hex)) {
        s.history = [hex, ...s.history.slice(0, 9)]; // Keep last 10
      }
      return s;
    });
  },

  /** Add a color to user favorites */
  toggleFavorite: (hex: string) => {
    colorStore.update(s => {
      if (s.favorites.includes(hex)) {
        s.favorites = s.favorites.filter(c => c !== hex);
      } else {
        s.favorites = [...s.favorites, hex];
      }
      return s;
    });
  },

  /** Reset selection to default */
  clearFormatting: () => {
    colorStore.update(s => {
      s.selection = { text: '#000000', highlight: 'transparent', background: 'transparent' };
      return s;
    });
  }
};