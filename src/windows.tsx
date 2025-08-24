import { ReactElement, useState } from "react";
import { List, TextAccessory } from "@project-gauntlet/api/components";

interface SearchRequest {
  Search: string;
}

interface ActivateRequest {
  Activate: number;
}

interface SearchResult {
  id: number;
  name: string;
  description: string;
  keywords?: string[];
  icon?: {
    Name: string;
  } | {
    Mime: string;
  };
  exec?: string;
  window?: number;
}

type PopLauncherRequest = SearchRequest | ActivateRequest | "Exit" | "Interrupt";

type PopLauncherResponse =
  | { Update: SearchResult[] }
  | { Fill: string }
  | { Close: null };

export default function SearchBarExample(): ReactElement {
  const pop = new PopLauncherClient()
  pop.connect();
  const [searchText, setSearchText] = useState<string | undefined>("");
  const [results, setResults] = useState<SearchResult[]>([])

  return (
    <List>
      <List.SearchBar placeholder="What knowledge do you seek...?"
        value={searchText}
        onChange={async (value) => {
          const results = await pop.search(value ?? '');
          console.log(results)
          setResults(results)

          setSearchText(value)
        }}
      />
      {results
        // .filter(value => !searchText ? true : value.toLowerCase().includes(searchText))
        .map(value => (
          <List.Item subtitle={value.description} id={value.id.toString()} title={value.name}
            accessories={[
              <TextAccessory text={value.icon?.Name || value.icon?.Mime || ''} />
            ]}
          />
        ))
      }
    </List>
  )
}

export class PopLauncherClient {
  private process: Deno.ChildProcess | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();

  async connect(): Promise<void> {
    try {
      const command = new Deno.Command("pop-launcher", {
        stdin: "piped",
        stdout: "piped",
        stderr: "piped"
      });

      this.process = command.spawn();

      if (!this.process.stdin || !this.process.stdout) {
        throw new Error("Failed to create pipes");
      }

      this.writer = this.process.stdin.getWriter();
      this.reader = this.process.stdout.getReader();

      console.log("Connected to pop-launcher");
    } catch (error) {
      throw new Error(`Failed to spawn pop-launcher: ${error}`);
    }
  }

  async sendRequest(request: PopLauncherRequest): Promise<void> {
    if (!this.writer) {
      throw new Error("Not connected");
    }

    const jsonString = JSON.stringify(request);
    const data = this.encoder.encode(jsonString + "\n");

    try {
      await this.writer.write(data);
      console.log("Sent:", jsonString);
    } catch (error) {
      throw new Error(`Failed to send request: ${error}`);
    }
  }

  async readResponse(): Promise<PopLauncherResponse | null> {
    if (!this.reader) {
      throw new Error("Not connected");
    }

    try {
      const { value, done } = await this.reader.read();

      if (done) {
        return null;
      }

      const text = this.decoder.decode(value);
      const lines = text.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const response = JSON.parse(line) as PopLauncherResponse;
          console.log("Received:", JSON.stringify(response, null, 2));
          return response;
        } catch (parseError) {
          console.warn("Failed to parse response:", line);
        }
      }
    } catch (error) {
      console.error("Error reading response:", error);
    }

    return null;
  }

  async search(query: string): Promise<SearchResult[]> {
    await this.sendRequest({ Search: query });

    const response = await this.readResponse();

    if (response && 'Update' in response) {
      return response.Update;
    }

    return [];
  }

  async activate(id: number): Promise<void> {
    await this.sendRequest({ Activate: id });
  }

  async close(): Promise<void> {
    try {
      if (this.writer) {
        await this.sendRequest("Exit");
        await this.writer.close();
        this.writer = null;
      }

      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }

      if (this.process) {
        await this.process.status;
        this.process = null;
      }

      console.log("Disconnected from pop-launcher");
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }
}
