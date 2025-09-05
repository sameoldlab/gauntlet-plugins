import { ReactElement, useState } from "react";
import { List, TextAccessory } from "@project-gauntlet/api/components";
import { PopLauncherClient, SearchResult } from "./script/pop-launcher";

const pop = new PopLauncherClient()
pop.connect();

export default function(): ReactElement {
  const [searchText, setSearchText] = useState<string | undefined>("");
  const [results, setResults] = useState<SearchResult[]>([])

  return (<List>
    <List.SearchBar placeholder="~/"
      value={searchText}
      onChange={async (value) => {
        setSearchText(value)
        const query = '~/' + value
        const results = await pop.search(query);
        setResults(results)
      }}
    />
    {results.map((value, i) => (
      <List.Item subtitle={value.description} id={i.toString()} title={value.name} />
    ))
    }
  </List>)
}
