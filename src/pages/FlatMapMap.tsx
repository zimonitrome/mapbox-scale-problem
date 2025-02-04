import { ParentComponent, createEffect, createSignal, onMount } from "solid-js";
import mapboxgl, { Marker } from "mapbox-gl";
import { projection } from "./FlatMap";
import { getAlpha } from "./helpers";
import potrace from "potrace";
import { geoFromSVGXML } from 'svg2geojson';

const debug = false;

function updateSource(features: any = {}, source: any) {
  const featuresById = new Map();
  for (const feature of source._data.features) featuresById.set(feature.id, feature);
  for (const feature of features) featuresById.set(feature.id, feature);
  source._data.features = [...featuresById.values()];
  source._updateWorkerData(true);
}

let mapElement: HTMLDivElement | undefined = undefined;
let geojsonSource: mapboxgl.GeoJSONSource = {
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: []
  }
};

export const [map, setMap] = createSignal<mapboxgl.Map>();

const markers: Marker[] = [];

const clone = (obj: any) => JSON.parse(JSON.stringify(obj));

// const getCorners = (center: [number, number], sizeKm: number) => {
//   const lonDegPerKm = 111.32;
//   const latDegPerKm = 111.32;
//   const lonSize = sizeKm / lonDegPerKm;
//   const latSize = sizeKm / latDegPerKm;

//   return [
//     [center[0] - lonSize / 2, center[1] + latSize / 2], // top-left
//     [center[0] + lonSize / 2, center[1] + latSize / 2], // top-right
//     [center[0] + lonSize / 2, center[1] - latSize / 2], // bottom-right
//     [center[0] - lonSize / 2, center[1] - latSize / 2]  // bottom-left
//   ];
// };

const getCorners = (center: [number, number], sizeKm: number) => {
  // Convert size to degrees based on latitude
  const latRad = center[1] * Math.PI / 180;
  // Length of 1 degree of longitude at this latitude
  const lonDegPerKm = 111.32 * Math.cos(latRad);
  // const lonDegPerKm = 111.32;
  // Length of 1 degree of latitude (approximately constant)
  const latDegPerKm = 111.32;

  const lonSize = sizeKm / lonDegPerKm;
  const latSize = sizeKm / latDegPerKm;

  const sign = Math.sign(latRad);
  const x = Math.abs(latRad / (Math.PI / 2));
  const k = 10;

  const adjust = sign * 8 * (Math.exp(k * x) - 1) / (Math.exp(k) - 1);
  // const adjust = 0;

  const ret = [
    [center[0] - lonSize / 2 - adjust, center[1] + latSize / 2], // top-left
    [center[0] + lonSize / 2 + adjust, center[1] + latSize / 2], // top-right
    [center[0] + lonSize / 2 - adjust, center[1] - latSize / 2], // bottom-right
    [center[0] - lonSize / 2 + adjust, center[1] - latSize / 2]  // bottom-left
  ];

  return ret;

  // // Clamp coordinates to valid latitude and longitude ranges
  // const clampLng = (lng: number) => Math.max(-180, Math.min(180, lng));
  // const clampLat = (lat: number) => Math.max(-90, Math.min(90, lat));

  // return ret.map(([lng, lat]) => [clampLng(lng), clampLat(lat)]);
};

// Function to scale coordinates around a center point
const scaleCoordinates = (coordinates: number[][][], center: [number, number], scale: number) => {
  return coordinates.map(c => c.map(coord => [
    center[0] + (coord[0] - center[0]) * scale,
    center[1] + (coord[1] - center[1]) * scale
  ]));
};

export const setupHoverAnimation = (map: mapboxgl.Map) => {
  let hoveredFeatureId: number | null = null;
  const animatingFeatures = new Map<number, number>(); // featureId -> animationFrame

  const updateFeature = (
    feature: any,
    imageSourceId: string,
    progress: number
  ) => {
    const center: [number, number] = [feature.properties.centerX, feature.properties.centerY];
    const sizeKm: number = feature.properties.sizeKm;

    // Simple easing function
    const easeProgress = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    // Scale factor based on progress
    const scale = 1 + (0.2 * easeProgress);

    const source = map.getSource('polygonsSource') as mapboxgl.GeoJSONSource;
    updateSource([feature], source);

    // Update image coordinates
    const imageSource = map.getSource(imageSourceId) as mapboxgl.ImageSource;
    if (imageSource) {
      imageSource.setCoordinates(getCorners(center, sizeKm * scale));
    }
  };

  const animate = (
    feature: any,
    imageSourceId: string,
    targetProgress: number,
    startTime: number
  ) => {
    const currentTime = performance.now();
    const elapsed = currentTime - startTime;
    const duration = 100;
    
    // Calculate new progress
    const startProgress = feature.properties.progress || 0;
    const progressDiff = targetProgress - startProgress;
    const newProgress = startProgress + (progressDiff * Math.min(elapsed / duration, 1));
    
    // Store the current progress
    feature.properties.progress = newProgress;
    
    // Update the feature with new progress
    updateFeature(feature, imageSourceId, newProgress);

    // Continue animation if we haven't reached target
    if (Math.abs(newProgress - targetProgress) > 0.01) {
      const animationFrame = requestAnimationFrame(() => 
        animate(feature, imageSourceId, targetProgress, startTime)
      );
      animatingFeatures.set(feature.id, animationFrame);
    } else {
      // Animation complete, cleanup
      feature.properties.progress = targetProgress;
      updateFeature(feature, imageSourceId, targetProgress);
      animatingFeatures.delete(feature.id);
    }
  };

  const startAnimation = (feature: any, hovering: boolean) => {
    // Cancel any existing animation for this feature
    const existingAnimation = animatingFeatures.get(feature.id);
    if (existingAnimation) {
      cancelAnimationFrame(existingAnimation);
      animatingFeatures.delete(feature.id);
    }

    const imageSourceId = `${feature.properties.centerY}_${feature.properties.centerX}_source`;
    const targetProgress = hovering ? 1 : 0;

    // Scale the geojson polygon
    if (feature.geometry.coordinates) {
      const originalCoords = JSON.parse(feature.properties.originalCoordinates);
      feature.geometry.coordinates = scaleCoordinates(originalCoords, [feature.properties.centerX, feature.properties.centerY], hovering ? 1.2 : 1);
    }

    animate(feature, imageSourceId, targetProgress, performance.now());
  };

  // Setup event handlers
  map.on('mousemove', 'polygonLayer', (e) => {
    if (e.features.length > 0) {
      const feature = e.features[0];
      const featureId = feature.id as number;

      if (hoveredFeatureId !== featureId) {
        // Handle previous hover state
        if (hoveredFeatureId !== null) {
          const source = map.getSource('polygonsSource') as mapboxgl.GeoJSONSource;
          const prevFeature = (source as any)._data.features.find(
            (f: any) => f.id === hoveredFeatureId
          );
          
          if (prevFeature) {
            map.setFeatureState(
              { source: 'polygonsSource', id: hoveredFeatureId },
              { hover: false }
            );
            startAnimation(prevFeature, false);
          }
        }

        // Set new hover state
        hoveredFeatureId = featureId;
        map.setFeatureState(
          { source: 'polygonsSource', id: featureId },
          { hover: true }
        );
        
        if (feature.properties.progress === undefined) {
          feature.properties.progress = 0;
        }
        
        startAnimation(feature, true);
      }
    }
  });

  map.on('mouseleave', 'polygonLayer', () => {
    if (hoveredFeatureId !== null) {
      const source = map.getSource('polygonsSource') as mapboxgl.GeoJSONSource;
      const feature = (source as any)._data.features.find(
        (f: any) => f.id === hoveredFeatureId
      );

      if (feature) {
        map.setFeatureState(
          { source: 'polygonsSource', id: hoveredFeatureId },
          { hover: false }
        );
        startAnimation(feature, false);
      }

      hoveredFeatureId = null;
    }
  });
};

const addImageLayer = (map: mapboxgl.Map, imgSrc: string, corners: any, center: [number, number], sizeKm: number) => {
  const baseId = `${center[1]}_${center[0]}`;
  const sourceId = `${baseId}_source`;
  const layerId = `${baseId}_layer`;

  map.addSource(sourceId, {
    'type': 'image',
    'url': imgSrc,
    'coordinates': corners,
  });

  map.addLayer({
    id: layerId,
    'type': 'raster',
    'source': sourceId,
    'paint': {
      'raster-fade-duration': 0,
      'raster-opacity': debug ? 0.5 : 1,
      'raster-resampling': 'nearest',
    }
  });

  return { sourceId, layerId, center, sizeKm };
};

let id_counter = 0;

const addGeoJsonLayer = async (map: mapboxgl.Map, imgSrc: string, corners: any, center: [number, number], sizeKm: number) => {
  const alpha = await getAlpha(imgSrc);
  let orgGeojson;

  return new Promise((resolve, reject) => {
    potrace.trace(alpha, { optCurve: true }, (err, svg) => {
      if (err) return reject(err);

      const width = parseInt(svg.match(/width="(\d+)"/)![1]);
      const height = parseInt(svg.match(/height="(\d+)"/)![1]);

      const svgLines = svg.split('\n');
      svgLines.splice(1, 0, `<MetaInfo xmlns="http://www.prognoz.ru"><Geo>
        <GeoItem X="${width}" Y="${height}" Longitude="${corners[2][0]}" Latitude="${corners[2][1]}"/>
        <GeoItem X="${0}" Y="${0}" Longitude="${corners[0][0]}" Latitude="${corners[0][1]}"/>
      </Geo></MetaInfo>`);
      svg = svgLines.join('\n');

      geoFromSVGXML(svg, geojson => {
        if (geojson.features[0].geometry.type === 'LineString') {
          geojson.features[0].geometry.type = 'Polygon';
          geojson.features[0].geometry.coordinates = [geojson.features[0].geometry.coordinates];
        }

        geojson.features[0].geometry.coordinates = geojson.features[0].geometry.coordinates.map(c => c.filter((_, i) => i % 2 === 0));

        geojson.features[0].id = id_counter; // TODO: something better
        id_counter++;
        orgGeojson = clone(geojson);

        geojson.features[0].properties = {
          ...geojson.features[0].properties,
          centerX: center[0],
          centerY: center[1],
          sizeKm,
          progress: 0,
          originalCoordinates: JSON.stringify(geojson.features[0].geometry.coordinates)
        };

        const sourceId = `${center[1]}_${center[0]}_geojson_source`;
        const layerId = `${center[1]}_${center[0]}_geojson_layer`;

        const source = map.getSource("polygonsSource") as mapboxgl.GeoJSONSource;

        // LMAO we should just be able to do source.updateData(data) but that doesn't work lol
        updateSource(geojson.features, source);


        resolve({ sourceId, layerId, orgGeojson });
      });
    });
  });
};

export const FlatMapMap: ParentComponent = (props) => {
  onMount(async () => {
    mapboxgl.accessToken = "pk.eyJ1Ijoiemltb25pdHJvbWUiLCJhIjoiY2xobW0zZGtwMWRldTNkbnVhNnk1NmIxeCJ9.oSRHcrxFqxJhaKps59a4Bw";

    const _map = new mapboxgl.Map({
      container: mapElement!,
      zoom: 2,
      minZoom: 0,
      // center: [50, 50],
      center: [0, 0],
      projection: { name: projection() },
    });

    _map.on('load', async () => {

      const addCombinedLayer = async (map: mapboxgl.Map, imgSrc: string, center: [number, number], sizeKm: number) => {
        const corners = getCorners(center, sizeKm);
        const imageLayer = addImageLayer(map, imgSrc, corners, center, sizeKm);
        const geoJsonLayer = await addGeoJsonLayer(map, imgSrc, corners, center, sizeKm);

        return { imageLayer, geoJsonLayer };
      };


      await _map.addSource("polygonsSource", {
        'type': 'geojson',
        'data': geojsonSource.data,
        'dynamic': false
      });

      await _map.addLayer({
        'id': "polygonLayer",
        'type': 'fill',
        'source': "polygonsSource",
        'layout': {},
        'paint': {
          'fill-color': '#627BC1',
          'fill-opacity': debug ? 0.5 : 0,
        }
      });

      setupHoverAnimation(_map);


      // let a = 5;
      // let b = 0;
      // let c = 5;
      let a = 170;
      let b = 80;
      let c = 10;

      console.log("n layers", (2 * a / c + 1) * (2 * b / c + 1));
      // await addCombinedLayer(_map, '/mapbox-scale-problem/src/assets/3.png', [0, 0], 500);
      for (let x = -a; x <= a; x += c) {
        for (let y = -b; y <= b; y += c) {
          await addCombinedLayer(_map, 'https://raw.githubusercontent.com/zimonitrome/mapbox-scale-problem/refs/heads/main/src/assets/3.png', [x, y], 1200);
        }
      }
      // await addCombinedLayer(_map, '/mapbox-scale-problem/src/assets/2.png', [10, 10], 500);
    });

    setMap(_map);
  });

  createEffect(() => {
    projection();
    map()?.setProjection({ name: projection() });
  });

  return <div
    style={{ width: "600px", height: "400px" }}
    ref={mapElement}
  />;
};