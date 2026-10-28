/**
 * @file /src/constants/pageMargins.ts
 * @name PageMargins
 * @description Constants for page margins in the editor.
 */

import { PaperOrientation, PaperOrientationSelect } from '../types/paper'
import { titleCase } from '../utils/string'

/**
 * Converts a string to title case.
 *
 * @param str - The input string to convert.
 * @returns {string} The string in title case.
 */
// export const titleCase = (str: string) => {
//   return str.replace(/\b\w/g, (char) => char.toUpperCase())
// }

export const paperOrientations: PaperOrientation[] = ['portrait', 'landscape']

/**
 * A mapped version of the paper orientations where the oreintation is the key
 * and the label is the title cased version of the orientation. E.g. can be used
 * in a select input.
 */
export const paperOrientationsSelect: PaperOrientationSelect[] = paperOrientations.map(
  (orientation) => ({
    orientation,
    label: titleCase(orientation)
  })
)

export const DEFAULT_PAPER_ORIENTATION: PaperOrientation = 'portrait'
