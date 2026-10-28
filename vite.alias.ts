import path from 'path'

export const sharedAliases = {
  rootDir: path.resolve(__dirname, ''),
  builtInExtensionsDir: path.resolve(__dirname, 'extensions'),
  srcDir: path.resolve(__dirname, 'src'),
  assetsDir: path.resolve(__dirname, 'src/renderer/src/assets'),
  assetsImgDir: path.resolve(__dirname, 'src/renderer/src/assets/img'),
  '@resources': path.resolve(__dirname, 'resources')
}

