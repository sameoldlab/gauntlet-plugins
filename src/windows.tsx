import { ReactElement, useState } from "react";
import { Action, ActionPanel, Inline, List, TextAccessory } from "@project-gauntlet/api/components";

export default function(): ReactElement {
  const [searchText, setSearchText] = useState<string | undefined>("");
  const [results, setResults] = useState<{ id: string, title: string }[]>([])
  const dec = new TextDecoder()

  new Deno.Command('wlrctl', {
    args: ["toplevel", "list"]
  }).output().then((cmd) => {
    if (!cmd.success) {
      let err = dec.decode(cmd.stderr)
      console.log(err)
      return
    }

    let output = dec.decode(cmd.stdout).trim().split('\n').map(line => {
      const [id, title] = line.split(': ')
      return { id, title }
    })
    setResults(output)
  })

  const select = (title: string) => new Deno.Command('wlrctl', {
    args: ["toplevel", "focus", `title:${title}`]
  }).spawn()

  return (<List
    actions={<ActionPanel>
      <Action label="Focus" onAction={(id) => {
        if (id) select(id)
      }} />
    </ActionPanel>}
  >
    <List.SearchBar
      value={searchText}
      onChange={async (value) => {
        setSearchText(value)
      }}
    />
    {results.map(app => (
      <List.Item id={app.title} title={app.title} subtitle={app.id} />
    ))}
  </List>)
}
