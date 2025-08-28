import { ReactElement, useMemo, useState, useCallback } from "react";
import { Action, ActionPanel, Detail, Icons, List, TextAccessory } from "@project-gauntlet/api/components";

interface File {
  id: number;
  path: string;
  name: string;
  mime?: string;
}

const MIME = (mime: string): keyof typeof Icons => {
  // const mime = getMimeType(path)

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

// Get MIME type using file command
function getMimeType(filePath: string) {
  try {
    const command = new Deno.Command("file", {
      args: ["--mime-type", "-b", filePath],
      stdout: "piped",
      stderr: "piped"
    });

    const output = command.outputSync();
    if (output.code === 0) {
      return new TextDecoder().decode(output.stdout).trim();
    }
  } catch {
    // Fallback to basic detection
  }

  const ext = filePath.split('.').pop()?.toLowerCase();
  if (ext === 'rs') return 'text/x-rust';
  if (['js', 'ts', 'jsx', 'tsx'].includes(ext || '')) return 'application/javascript';
  if (['png', 'jpg', 'jpeg', 'gif'].includes(ext || '')) return 'image/' + ext;
  if (['mp4', 'avi', 'mkv'].includes(ext || '')) return 'video/' + ext;
  if (['mp3', 'wav', 'flac'].includes(ext || '')) return 'audio/' + ext;

  return 'text/plain';
}

function Finder() {
  const process = new Deno.Command("goldfish", {
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

    const search = (query: string) => {
      writer.write(encoder.encode(`q:${query}\n`))
      console.log("encoded query")
    }

    const exit = () => writer.write(encoder.encode(`c:Exit`))

    const read = async (): Promise<File[]> => {
      const res = await reader.read();
      const [len, ...lines] = decoder.decode(res.value).split('\n').filter(line => line.trim());
      return Promise.all(lines
        .map(async (path, id) => {
          const name = path.split('/').pop() || path;
          const mime = getMimeType(path);
          return { id, path, name, mime }
        }));
    }

    return { search, exit, read }

  } catch (error) {
    throw new Error(`Failed to spawn fuzzy-fd: ${error}`);
  }
}
const { search, exit, read } = Finder()

// Open file with default application
function openFile(filePath: string) {
  try {
    return new Deno.Command("xdg-open", {
      args: [filePath],
      stdout: "piped",
      stderr: "piped"
    }).output();

  } catch (error) {
    console.error("Failed to open file:", error);
  }
}


export default function(): ReactElement {
  const [searchText, setSearchText] = useState<string>("");
  const [results, setResults] = useState<File[]>([]);
  const [selectedFile, setSelectedFile] = useState<number | undefined>();

  const details = useMemo(() => {
    if (typeof selectedFile != 'number') return undefined;
    if (results.length === 0) return undefined

    const { path, name, mime } = results[selectedFile]!
    const fileinfo = Deno.lstatSync(path)
    try {
      return {
        ...fileinfo,
        path,
        name,
        mime
      };
    } catch {
      return undefined;
    }
  }, [selectedFile, results]);

  return (
    <List
      onItemFocusChange={id => setSelectedFile(id !== undefined ? parseInt(id) : undefined)}
      actions={
        <ActionPanel>
          <Action
            label="Open File"
            onAction={(path) => path && openFile(path)}
          />
          <Action
            label="Copy Path"
            onAction={(path) => path && navigator.clipboard?.writeText(path)}
          />
        </ActionPanel>
      }
    >
      <List.SearchBar
        value={searchText}
        onChange={async (query = "") => {
          setSearchText(query)
          if (query.trim().length == 0) return setResults([])
          search(query)

          read().then(results => {
            setResults(results);
            // setSelectedFile(0)
          })
        }}
        placeholder="Search files"
      />

      {results.map((file) => (
        <List.Item
          key={file.path}
          id={file.id.toString()}
          title={file.name}
          icon={Icons[MIME(file.mime ?? '')]}
        // accessories={[
        //   file.mime && <TextAccessory text={file.mime.split('/')[0]} />
        // ]}
        />
      ))}

      {details && (
        <List.Detail>
          <List.Detail.Metadata>
            <List.Detail.Metadata.Value label="Path">
              {details.path}
            </List.Detail.Metadata.Value>
            <List.Detail.Metadata.Value label="Name">
              {details.name}
            </List.Detail.Metadata.Value>
            <List.Detail.Metadata.Value label="MIME Type">
              {details.mime || 'Unknown'}
            </List.Detail.Metadata.Value>
            <List.Detail.Metadata.Value label="Size">
              {formatFileSize(details.size)}
            </List.Detail.Metadata.Value>
            <List.Detail.Metadata.Value label="Modified">
              {details.mtime?.toLocaleString() || 'Unknown'}
            </List.Detail.Metadata.Value>
            <List.Detail.Metadata.Value label="Created">
              {details.birthtime?.toLocaleString() || 'Unknown'}
            </List.Detail.Metadata.Value>
            <List.Detail.Metadata.Value label="Permissions">
              {formatPermissions(details.mode)}
            </List.Detail.Metadata.Value>
          </List.Detail.Metadata>

        </List.Detail>
      )}
    </List>
  );
}

// Utility functions
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatPermissions(mode: number | null): string {
  if (mode === null) return 'Unknown';

  const permissions = [];
  const owner = (mode >> 6) & 7;
  const group = (mode >> 3) & 7;
  const other = mode & 7;

  const formatTriad = (n: number) => {
    return ((n & 4) ? 'r' : '-') +
      ((n & 2) ? 'w' : '-') +
      ((n & 1) ? 'x' : '-');
  };

  return formatTriad(owner) + formatTriad(group) + formatTriad(other);
}
