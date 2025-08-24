import { ReactElement, useMemo, useState } from "react";
import { Action, ActionPanel, Detail, Icons, List, TextAccessory } from "@project-gauntlet/api/components";
import { PopLauncherClient, SearchResult } from "./script/pop-launcher";
const pop = new PopLauncherClient()
pop.connect();

const MIME = (mime: string | undefined): keyof typeof Icons => {
  if (!mime) return 'Document'
  if (mime.includes('image')) return "Image"
  if (mime.includes('directory')) return "Folder"
  if (mime.includes('video')) return "Film"
  if (mime.includes('audio')) return "Music"
  if (mime.includes('application')) return "Code"
  if (mime.includes('html')) return "Code"
  if (mime.includes('x-rust')) return "Code"
  if (mime.includes('text')) return "Text"

  return "Document"
}
export default function(): ReactElement {
  const [searchText, setSearchText] = useState<string | undefined>("");
  const [results, setResults] = useState<SearchResult<{ Mime: string }>[]>([])
  const [id, setId] = useState<number | undefined>(undefined)

  const file = useMemo(() => {
    if (id === undefined || results.length === 0) return
    const fileInfo = Deno.lstatSync(results[id].description.replace('~/', Deno.env.get("HOME")!))
    return fileInfo
  }, [id])

  return (<List
    onItemFocusChange={id => setId(parseInt(id ?? '0'))}
    actions={
      <ActionPanel>
        <Action label="Open" onAction={(id) => pop.activate(parseInt(id ?? '0'))} />
      </ActionPanel>
    }>
    <List.SearchBar
      value={searchText}
      onChange={(value) => {
        setSearchText(value)
        pop.search('find ' + value).then(setResults)
      }}
    />
    {results.map((value) => (
      <List.Item key={value.id} id={value.id.toString()} title={value.name} icon={Icons[MIME(value.icon?.Mime)]} />
    ))
    }
    {(file && id !== undefined) &&
      <List.Detail>
        <List.Detail.Metadata>
          <List.Detail.Metadata.Value label={"Path"}>{results[id].description}</List.Detail.Metadata.Value>
          <List.Detail.Metadata.Value label={"Mime"}>{results[id].icon.Mime}</List.Detail.Metadata.Value>
          <List.Detail.Metadata.Value label={"Size"}>{file.size.toString()}</List.Detail.Metadata.Value>
          <List.Detail.Metadata.Value label={"Modified"}>{file.mtime?.toLocaleString()}</List.Detail.Metadata.Value>
          <List.Detail.Metadata.Value label={"Created"}>{file.ctime?.toLocaleString()}</List.Detail.Metadata.Value>
        </List.Detail.Metadata>
        <List.Detail.Content>
          <List.Detail.Content.H4>
            {results[id]?.name}
          </List.Detail.Content.H4>
        </List.Detail.Content>
      </List.Detail>
    }

  </List>)
}
