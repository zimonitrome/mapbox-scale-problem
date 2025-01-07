import { createSignal, type Component } from 'solid-js';
import { SymbolScaleLayer } from './SymbolScaleLayer';

export const [scalingEnabled, setScalingEnabled] = createSignal(true);
export const [projection, setProjection] = createSignal<"globe" | "mercator">("globe");


const SymbolScaleExample: Component = () => {
  return (
    <div style={{
      "background-color": 'lightgrey',
      display: 'flex',
      "flex-direction": 'column',
      "align-items": 'center',
      gap: '20px',
      padding: '20px',
    }}>
      <h1>MapboxGL Symbol Scaling Example</h1>

      <div style={{ display: 'flex', "justify-content": 'space-around', width: '100%' }}>
        <div style={{ "text-align": 'center' }}>
          <h2>Layer Map</h2>
          <SymbolScaleLayer />
        </div>
      </div>

      <div>
        <label>
          Projection:&nbsp;
          <select onChange={(event: Event) => {
            const target = event.target as HTMLSelectElement;
            setProjection(target.value as any);
          }} value={projection()}>
            <option value="mercator">Mercator</option>
            <option value="globe">Globe</option>
          </select>
        </label>

        <br />

        <label>
          Scaling
          <input type="checkbox" checked={scalingEnabled()} onChange={(event: Event) => {
            const target = event.target as HTMLInputElement;
            setScalingEnabled(target.checked);
          }} />
        </label>
      </div>
    </div>
  );
};

export default SymbolScaleExample;
