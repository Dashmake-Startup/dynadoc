export class ZipFile {
  constructor() {
    throw new Error(
      'yazl is not available in web/mobile builds. Use window.api.ddocify instead.'
    )
  }
}

