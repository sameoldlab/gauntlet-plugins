const { os } = Deno.build
const OS_CMD: Record<string, string> = Object.freeze({
  darwin: "open",
  windows: "explorer",
  linux: "xdg-open",
})

/** Open file or path with default application */
export function open(target: string): Promise<Deno.CommandOutput> {
  if (!Object.keys(OS_CMD).includes(os)) throw new Error(`unsupported os: ${os}`)

  // Directory should be opened in default explorer. This is the only supported mode for windows
  const reveal = target.endsWith(os === 'windows' ? '\\' : '/')

  return new Deno.Command(OS_CMD[os], {
    args: [target],
  }).output()
}
