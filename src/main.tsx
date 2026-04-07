import { render } from "@solidjs/web";

import "./style.css";

function App() {
  return (
    <main class="app-shell">
      <section class="card">
        <p class="eyebrow">Solid SPA</p>
        <h1>printable.photos</h1>
      </section>
    </main>
  );
}

render(() => <App />, document.getElementById("app")!);
