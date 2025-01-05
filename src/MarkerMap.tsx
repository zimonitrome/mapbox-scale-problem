import { ParentComponent, createEffect, createSignal, onMount } from "solid-js";
import mapboxgl, { Marker } from "mapbox-gl";
import { calculateDistScale } from "./helpers";
import 'mapbox-gl/dist/mapbox-gl.css';
import { projection, scalingEnabled } from "./App";

let mapElement: HTMLDivElement | undefined = undefined;

export const [map, setMap] = createSignal<mapboxgl.Map>();

const markers: Marker[] = [];

export const MarkerMap: ParentComponent = (props) => {
  onMount(async () => {
    // Add map to DOM

    mapboxgl.accessToken = "pk.eyJ1Ijoiemltb25pdHJvbWUiLCJhIjoiY2xobW0zZGtwMWRldTNkbnVhNnk1NmIxeCJ9.oSRHcrxFqxJhaKps59a4Bw";
    const _map = new mapboxgl.Map({
      container: mapElement!,
      zoom: 2,
      minZoom: 0,
      center: [30, 50],
      projection: { name: projection() },
    });

    const scaleMarkers = () => {
      if (!scalingEnabled()) return;
      markers.forEach(marker => {
        const lngLat = marker.getLngLat();
        const scale = calculateDistScale(_map, lngLat);
        const svgElement = marker.getElement().firstChild! as HTMLElement;
        svgElement.style.scale = `${20*scale}`;
        svgElement.style.transformOrigin = "bottom center";
      });
    };

    _map.on('load', () => {
      const nMarkers = 1000;

      for (let i = 0; i < nMarkers; i++) {
  
        const lng = Math.random() * 360 - 180;
        const lat = Math.random() * 180 - 90;
  
        const marker = new mapboxgl.Marker().setLngLat([lng, lat]).addTo(map()!);
        markers.push(marker);
      }

      scaleMarkers();
    });

    _map.on("move", () => {
      scaleMarkers();
    });

    setMap(_map);
  })

  createEffect(() => {
    projection();
    map()?.setProjection({ name: projection() });
  });

  return <div
    style={{ width: "600px", height: "400px" }}
    ref={mapElement}
  />;
};