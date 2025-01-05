import { ParentComponent, createEffect, createSignal, onMount } from "solid-js";
import mapboxgl, { LngLat, Marker } from "mapbox-gl";
import { calculateDistScale } from "./helpers";
import 'mapbox-gl/dist/mapbox-gl.css';
import { projection, scalingEnabled } from "./App";

let mapElement: HTMLDivElement | undefined = undefined;

export const [map, setMap] = createSignal<mapboxgl.Map>();

const markers: Marker[] = [];

export const LayerMap: ParentComponent = (props) => {
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

      const geojsonSource = map()!.getSource('points') as mapboxgl.GeoJSONSource;
      const geojsonFeatures = (geojsonSource._data as any).features;

      if (!geojsonSource) return;

      geojsonSource.setData({
        'type': 'FeatureCollection',
        'features': geojsonFeatures.map((feature: any) => {
          const lngLat = feature.geometry.coordinates;
          const scale = calculateDistScale(_map, new LngLat(lngLat[0], lngLat[1]));
          return {
            ...feature,
            'properties': {
              'scale': 20 * scale
            }
          }
        })
      });

      // Force refresh by temporarily removing and re-adding the layer
      if (map()!.getLayer('points')) {
        map()!.removeLayer('points');
        map()!.addLayer({
          'id': 'points',
          'type': 'symbol',
          'source': 'points',
          'layout': {
            'icon-image': 'custom-marker',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-size': ['get', 'scale']  // Use feature's scale property
          }
        });
      }
    };

    _map.on('load', () => {
      const nMarkers = 1000;

      _map.loadImage(
        'https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png',
        (error, image) => {
          if (error) throw error;
          _map.addImage('custom-marker', image!);

          const markerCoords: Array<LngLat> = [];

          for (let i = 0; i < nMarkers; i++) {
            const lng = Math.random() * 360 - 180;
            const lat = Math.random() * 180 - 90;
            markerCoords.push(new LngLat(lng, lat));
          }

          _map.addSource('points', {
            'type': 'geojson',
            'data': {
              'type': 'FeatureCollection',
              'features':
                markerCoords.map((lngLat, i) => {
                  return {
                    'type': 'Feature',
                    'geometry': {
                      'type': 'Point',
                      'coordinates': [lngLat.lng, lngLat.lat]
                    },
                    'properties': {}
                  }
                })
            }
          });

          // Add a symbol layer
          _map.addLayer({
            'id': 'points',
            'type': 'symbol',
            'source': 'points',
            'layout': {
              'icon-image': 'custom-marker',
              'icon-allow-overlap': true,  // Ensure markers always show
              'icon-ignore-placement': true, // Ignore placement rules
            }
          });

          _map.setLayoutProperty('points', 'icon-size', [
            'get', 'scale'  // Use 'scale' property from GeoJSON for individual markers
          ]);

        }
      );

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