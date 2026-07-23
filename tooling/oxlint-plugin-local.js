const EXPORT_TYPES = new Set([
  'ExportNamedDeclaration',
  'ExportDefaultDeclaration',
  'ExportAllDeclaration',
])

function isExport(node) {
  return EXPORT_TYPES.has(node.type)
}

function isFunctionDeclaration(node) {
  if (node.type === 'FunctionDeclaration') {
    return true
  }

  return (
    isExport(node) && node.declaration != null && node.declaration.type === 'FunctionDeclaration'
  )
}

function hasBlankBetween(prev, cur) {
  return cur.loc.start.line - prev.loc.end.line >= 2
}

function isSingleLine(node) {
  return node.loc.start.line === node.loc.end.line
}

function isSingleLineDeclaration(node) {
  if (!isSingleLine(node)) {
    return false
  }

  if (node.type === 'VariableDeclaration') {
    return node.kind === 'const' || node.kind === 'let'
  }

  return node.type === 'TSTypeAliasDeclaration'
}

function isMultiLineType(node) {
  return node.type === 'TSTypeAliasDeclaration' && !isSingleLine(node)
}

const LOOP_TYPES = new Set([
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
])

function isLoop(node) {
  return LOOP_TYPES.has(node.type)
}

function paddingReason(prev, cur) {
  if (isFunctionDeclaration(cur)) {
    return 'before a function declaration'
  }

  if (isMultiLineType(cur)) {
    return 'before a multi-line type'
  }

  if (isExport(prev)) {
    return 'after an export'
  }

  if (prev.type === 'IfStatement') {
    return 'after an if statement'
  }

  if (isLoop(prev)) {
    return 'after a loop'
  }

  if (isMultiLineType(prev)) {
    return 'after a multi-line type'
  }

  if (isSingleLineDeclaration(prev) && !isSingleLineDeclaration(cur)) {
    return 'after a single-line declaration'
  }

  if (cur.type === 'ReturnStatement') {
    return 'before a return that follows another statement'
  }

  return null
}

function checkBody(context, body) {
  const source = context.sourceCode

  for (let i = 1; i < body.length; i++) {
    const prev = body[i - 1]
    const cur = body[i]
    const reason = paddingReason(prev, cur)

    if (reason == null || hasBlankBetween(prev, cur)) {
      continue
    }

    const lineStart = source.getIndexFromLoc({ line: cur.loc.start.line, column: 0 })

    context.report({
      node: cur,
      message: `Expected a blank line ${reason}.`,
      fix(fixer) {
        return fixer.insertTextBeforeRange([lineStart, lineStart], '\n')
      },
    })
  }
}

const paddingLines = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: {
      description:
        'Require blank lines after exports, if statements, loops, single-line declarations, and around multi-line type aliases, and before function declarations and trailing returns.',
    },
  },
  create(context) {
    return {
      Program(node) {
        checkBody(context, node.body)
      },
      BlockStatement(node) {
        checkBody(context, node.body)
      },
      StaticBlock(node) {
        checkBody(context, node.body)
      },
    }
  },
}

const noInlineExports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Declare values and types without inline export, then export them from a single block at the bottom of the file.',
    },
  },
  create(context) {
    return {
      ExportNamedDeclaration(node) {
        if (node.declaration == null) {
          return
        }

        context.report({
          node: node.declaration,
          message:
            'Declare this without inline export and add it to the single export block at the bottom of the file.',
        })
      },
    }
  },
}

export default {
  meta: { name: 'local' },
  rules: { 'padding-lines': paddingLines, 'no-inline-exports': noInlineExports },
}
