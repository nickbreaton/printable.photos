import { render } from "@solidjs/web";
import { Loading } from "solid-js";
import { FileSpreadsheet } from "lucide-static";

import "./style.css";
import { Fonts } from "./components/ui/Fonts";
import { Icon } from "./components/ui/Icon";
import { DownloadControls } from "./components/app/DownloadControls";
import { HeaderProjectDropdown } from "./components/app/HeaderProjectDropdown";
import { Pages } from "./components/app/Pages";
import { Sidebar } from "./components/app/Sidebar";
import { WebMcpTools } from "./webmcp";

function App() {
  return (
    <Loading>
      <Fonts />
      <WebMcpTools />
      <header class="px-5 py-3 grid grid-cols-subgrid col-span-2">
        <span class="font-semibold tracking-tight text-lg flex gap-2 items-center">
          <Icon icon={FileSpreadsheet} class="scale-150" />
          printable.photos
        </span>
        <div class="flex items-center justify-between gap-3">
          <HeaderProjectDropdown />
          <DownloadControls />
        </div>
      </header>
      <Sidebar />
      <main class="h-full contain-size bg-muted border-l-[1px] border-t-[1px] border-foreground/13 inset-shadow-xs/[3%] ">
        <Pages />
      </main>
    </Loading>
  );
}

render(() => <App />, document.getElementById("root")!);
