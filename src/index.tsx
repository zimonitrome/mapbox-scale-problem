import { render } from "solid-js/web";
import { Router, Route, A } from "@solidjs/router";

import ScaleExample from "./pages/ScaleExample";
import SymbolScaleExample from "./pages/SymbolScaleExample";
import FlatMap from "./pages/FlatMap";

const App = (props: any) => (
  <>
    <nav style={{ display: "flex", "flex-direction": "column" }}>
      <A href="/mapbox-scale-problem/">ScaleExample</A>
      <A href="/mapbox-scale-problem/SymbolScaleExample">SymbolScaleExample</A>
      <A href="/mapbox-scale-problem/FlatMap">FlatMap</A>
    </nav>
    {props.children}
  </>
);

render(
  () => (
    <Router root={App}>
      <Route path="/mapbox-scale-problem/" component={ScaleExample} />
      <Route path="/mapbox-scale-problem/SymbolScaleExample" component={SymbolScaleExample} />
      <Route path="/mapbox-scale-problem/FlatMap" component={FlatMap} />
    </Router>
  ),
  document.getElementById("root")!
);