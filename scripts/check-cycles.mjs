import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
// Added .svelte.ts and .svelte.js for Svelte 5 projects
const DEFAULT_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.svelte', '.svelte.ts', '.svelte.js']
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'out', 'build', '.git', '.svelte-kit', 'web', '.vite'])

/**
 * 1. ALIAS CONFIGURATION
 * These must match your vite.config.mts
 */
const ALIASES = {
  '@': path.resolve(ROOT, 'src/renderer/src'),
}

function loadIgnorePrefixes() {
  const ignoreFile = path.join(ROOT, '.cyclecheckignore')
  if (!fs.existsSync(ignoreFile)) return []
  return fs.readFileSync(ignoreFile, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
}

const IGNORE_PREFIXES = loadIgnorePrefixes()

function isIgnored(filePath) {
  const rel = path.relative(ROOT, filePath)
  if (rel.split(path.sep).some(part => IGNORE_DIRS.has(part))) return true
  return IGNORE_PREFIXES.some(prefix => rel.replace(/\\/g, '/').startsWith(prefix))
}

/**
 * 2. RESOLVE IMPORTS
 * Handles Aliases, Extensions, and Index files
 */
function resolveImport(fromFile, spec) {
  let targetPath = spec

  // Handle Aliases (@/...)
  for (const [alias, aliasPath] of Object.entries(ALIASES)) {
    if (spec.startsWith(alias)) {
      targetPath = spec.replace(alias, aliasPath)
      break
    }
  }

  // Ignore bare module imports (like 'svelte' or 'lodash')
  if (!path.isAbsolute(targetPath) && !targetPath.startsWith('.')) return null

  const baseDir = path.dirname(fromFile)
  const candidate = path.isAbsolute(targetPath) ? targetPath : path.resolve(baseDir, targetPath)

  // 1. Try exact file
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  
  // 2. Try adding extensions
  for (const ext of DEFAULT_EXTS) {
    if (fs.existsSync(candidate + ext)) return candidate + ext
  }
  
  // 3. Try directory index
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    for (const ext of DEFAULT_EXTS) {
      const index = path.join(candidate, 'index' + ext)
      if (fs.existsSync(index)) return index
    }
  }

  return null
}

function extractImports(filePath, content) {
  const imports = new Set()
  
  // Svelte file script extraction
  let code = content
  if (filePath.endsWith('.svelte')) {
    const scriptMatches = content.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || []
    code = scriptMatches.map(s => s.replace(/<script[^>]*>|<\/script>/gi, '')).join('\n')
  }
  
  // Strip comments to avoid false positives
  const clean = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')

  const patterns = [
    /from\s+['"]([^'"]+)['"]/g,             // import { x } from 'y'
    /import\s+['"]([^'"]+)['"]/g,           // import 'y'
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,    // import('y')
    /require\(\s*['"]([^'"]+)['"]\s*\)/g    // require('y')
  ]

  patterns.forEach(regex => {
    let match
    while ((match = regex.exec(clean))) {
      if (match[1]) imports.add(match[1])
    }
  })

  return Array.from(imports)
}

/**
 * 3. CYCLE DETECTION (DFS)
 */
function findCycles(graph) {
  const visited = new Set()
  const stack = new Set()
  const pathStack = []
  const cycles = []

  function dfs(node) {
    if (stack.has(node)) {
      const idx = pathStack.indexOf(node)
      if (idx !== -1) {
        cycles.push([...pathStack.slice(idx), node])
      }
      return
    }
    
    if (visited.has(node)) return

    visited.add(node)
    stack.add(node)
    pathStack.push(node)

    const neighbors = graph.get(node) || []
    for (const neighbor of neighbors) {
      dfs(neighbor)
    }

    pathStack.pop()
    stack.delete(node)
  }

  for (const node of graph.keys()) {
    dfs(node)
  }
  return cycles
}

// --- Execution ---

console.log('🔍 Scanning files for circular dependencies...')

function listFiles(dir) {
  const results = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (isIgnored(fullPath)) continue
    if (entry.isDirectory()) {
      results.push(...listFiles(fullPath))
    } else if (DEFAULT_EXTS.some(ext => fullPath.endsWith(ext))) {
      results.push(fullPath)
    }
  }
  return results
}

const allFiles = listFiles(ROOT)
const graph = new Map()

allFiles.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8')
    const rawImports = extractImports(file, content)
    const resolved = rawImports
      .map(spec => resolveImport(file, spec))
      .filter(Boolean)
    graph.set(file, resolved)
  } catch (e) {
    console.warn(`⚠️ Could not process ${file}: ${e.message}`)
  }
})

// Baseline of known pre-existing cycles. CI fails only if this count is exceeded.
// When cycles are fixed, lower this value to match the new count — never raise it.
const CYCLE_THRESHOLD = 255

const cycles = findCycles(graph)

if (cycles.length === 0) {
  console.log('✅ No circular dependencies found.')
} else if (cycles.length <= CYCLE_THRESHOLD) {
  console.warn(`⚠️  ${cycles.length}/${CYCLE_THRESHOLD} cycles — within pre-existing baseline. No regression.`)
} else {
  console.error(`\n❌ ${cycles.length} cycles — exceeds threshold of ${CYCLE_THRESHOLD}. New circular imports introduced:\n`)
  cycles.forEach((cycle, i) => {
    const formatted = cycle.map(p => path.relative(ROOT, p)).join(' ➔ ')
    console.log(`${i + 1}. ${formatted}`)
  })
  process.exit(1)
}
