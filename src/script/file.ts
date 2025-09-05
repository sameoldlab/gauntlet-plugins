const { os } = Deno.build
const OS_CMD: Record<string, { cmd: string, args: string[] }> = Object.freeze({
  darwin: { cmd: "file", args: ["--mime-type", "-b"] },
  linux: { cmd: "file", args: ["--mime-type", "-b"] },
})

/** Get MIME type using file command */
export function getMimeTypeSync(filePath: string): string {
  if (!Object.keys(OS_CMD).includes(os)) throw new Error(`unsupported os: ${os}`)

  const output = new Deno.Command(OS_CMD[os].cmd, {
    args: [...OS_CMD[os].args, filePath],
    stdout: "piped",
  }).outputSync();
  if (output.code === 0) {
    return new TextDecoder().decode(output.stdout).trim();
  }

  return 'text/plain';
}

