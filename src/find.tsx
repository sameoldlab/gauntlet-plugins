import { ReactElement, useMemo, useState } from "react";
import { Action, ActionPanel, Icons, List } from "@project-gauntlet/api/components";
import { Clipboard } from "@project-gauntlet/api/helpers"
import { open } from "./script/open"
import { getMimeTypeSync } from "./script/file";

interface File {
  id: number;
  path: string;
  name: string;
  mime?: string;
  data: null | ArrayBuffer | string
}

const MIME = (mime: string): keyof typeof Icons => {
  if (!mime) return 'Document'
  if (mime.includes('image')) return "Image"
  if (mime.includes('directory')) return "Folder"
  if (mime.includes('video')) return "Film"
  if (mime.includes('audio')) return "Music"
  if (mime.includes('application')) return "Code"
  if (mime.includes('html')) return "Code"
  if (mime.includes('text')) return "Text"
  return "Document"
}

function Finder() {
  const process = new Deno.Command("gf", {
    stdin: "piped",
    stderr: "null",
    stdout: "piped"
  }).spawn()

  try {
    if (!process.stdin || !process.stdout) {
      throw new Error("Failed to create pipes");
    }

    const writer = process.stdin.getWriter();
    const reader = process.stdout.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const exit = () => writer.write(encoder.encode(`c:Exit`))

    const search = async (query: string): Promise<File[]> => {

      writer.write(encoder.encode(`q:${query}\n`))
      const res = await reader.read();
      const [len, ...lines] = decoder.decode(res.value).split('\n').filter(line => line.trim());
      return Promise.all(lines
        .map(async (path, id) => {
          const name = path.split('/').pop() || path;
          const mime = getMimeTypeSync(path);
          return { id, path, name, mime, data: null }
        }));
    }

    return { search, exit }

  } catch (error) {
    throw new Error(`Failed to spawn fuzzy-fd: ${error}`);
  }
}
const finder = Finder()

const readData = (file: File) => {
  if (file.mime?.startsWith("image")) {
    let data = Deno.readFileSync(file.path)
    file.data = data.buffer
  } else if (file.mime?.startsWith("text")) {
    let data = Deno.readTextFileSync(file.path)
    file.data = data
  }
}


export default function(): ReactElement {
  const [searchText, setSearchText] = useState<string>("");
  const [results, setResults] = useState<File[]>([]);
  const [selectedFile, setSelectedFile] = useState<number | undefined>();

  const details = useMemo(() => {
    if (typeof selectedFile != 'number') return undefined;
    if (results.length === 0) return undefined

    const file = results[selectedFile]!
    if (!file.data) readData(file)
    const fileinfo = Deno.lstatSync(file.path)

    return {
      ...fileinfo,
      f: file,
    };
  }, [selectedFile, results]);

  return (
    <List
      onItemFocusChange={id => setSelectedFile((id && parseInt(id)) || 0)}
      actions={
        <ActionPanel>
          <Action
            id="open"
            label="Open"
            onAction={(id) => id && open(results[parseInt(id)].path)}
          />
          <Action
            id="reveal"
            label="Show in explorer"
            onAction={(id) => {
              if (!id) return
              const file = results[parseInt(id)]
              let path = file.path
              if (file.mime && file.mime !== 'inode/directory') {
                const idx = path.lastIndexOf(Deno.build.os === 'windows' ? '\\' : '/')
                path = path.slice(0, idx + 1)
              }
              open(path)
            }}
          />
          <Action
            id="copyFile"
            label="Copy File"
            onAction={async (id) => {
              if (!id) return
              let file = results[parseInt(id)]
              if (!file.data) readData(file)
              if (file.mime?.startsWith("text")) {
                Clipboard.write({ "text/plain": file.data as string })
              } else {
                Clipboard.write({ "image/png": file.data as ArrayBuffer })
              }
            }}
          />
          <Action
            id="copyPath"
            label="Copy Path"
            onAction={(id) => id && Clipboard.writeText(results[parseInt(id)].path)}
          />
        </ActionPanel>
      }
    >
      <List.SearchBar
        value={searchText}
        onChange={async (query = "") => {
          setSearchText(query)
          finder.search(query).then(setResults)
        }}
        placeholder="Search files"
      />

      {results.map((file, i) => (
        <List.Item
          key={i}
          id={file.id.toString()}
          title={file.name}
          icon={Icons[MIME(file.mime ?? '')]}
        />
      ))}

      {details && (
        <List.Detail>
          <List.Detail.Metadata>
            <List.Detail.Metadata.Value label="Name">
              {details.f.name}
            </List.Detail.Metadata.Value>
            <List.Detail.Metadata.Value label="Path">
              {details.f.path}
            </List.Detail.Metadata.Value>
            {details.f.mime != "inode/directory" && (
              <List.Detail.Metadata.Value label="Type">
                {details.f.mime || 'Unknown'}
              </List.Detail.Metadata.Value>
            )}
            <List.Detail.Metadata.Value label="Size">
              {fmtSize(details.size)}
            </List.Detail.Metadata.Value>
            <List.Detail.Metadata.Value label="Modified">
              {details.mtime?.toLocaleString() || 'Unknown'}
            </List.Detail.Metadata.Value>
            <List.Detail.Metadata.Value label="Created">
              {details.birthtime?.toLocaleString() || 'Unknown'}
            </List.Detail.Metadata.Value>
            <List.Detail.Metadata.Value label="Permissions">
              {fmtPerms(details.mode)}
            </List.Detail.Metadata.Value>
          </List.Detail.Metadata>
          {details.f.data && (
            <List.Detail.Content>
              {details.f.mime?.startsWith('text') && (
                <List.Detail.Content.Paragraph>
                  {details.f.data as string}
                </List.Detail.Content.Paragraph>)}
            </List.Detail.Content>
          )}

        </List.Detail>
      )
      }
    </List >
  );
}

function fmtSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function fmtPerms(mode: number | null): string {
  if (mode === null) return 'Unknown';

  const owner = (mode >> 6) & 7;
  const group = (mode >> 3) & 7;
  const other = mode & 7;

  const fmtTriad = (n: number) => {
    return ((n & 4) ? 'r' : '-') +
      ((n & 2) ? 'w' : '-') +
      ((n & 1) ? 'x' : '-');
  };

  return fmtTriad(owner) + fmtTriad(group) + fmtTriad(other);
}
