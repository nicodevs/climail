// Split argv into named options and bare positionals, so flags can appear in
// any order. `flags` take a following value; `booleans` are standalone.
// Option keys drop the leading '--' (e.g. '--save-attachments' -> 'save-attachments').
function parseArgs(argv, { flags = [], booleans = [] } = {}) {
  const options = {}
  const positionals = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (booleans.includes(arg)) {
      options[arg.replace(/^--/, '')] = true
    } else if (flags.includes(arg)) {
      options[arg.replace(/^--/, '')] = argv[++i]
    } else {
      positionals.push(arg)
    }
  }

  return { options, positionals }
}

export { parseArgs }
