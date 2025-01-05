import { LngLat } from "mapbox-gl";

export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

export function mean(arr: number[]): number {
  return arr.reduce((acc, val) => acc + val, 0) / arr.length;
}

export function getPointFromAngle(coord: LngLat, angle: number, distance: number): LngLat {
  /*
      Given a coordinate, create a new coordinate at the given real world distance in the 
      direction of the given angle, using the Haversine formula.
  */
  
  const R = 6371; // Earth's radius in km
  const distanceInRadians = distance / R; // Distance in radians

  const lat = toRadians(coord.lat);
  const lng = toRadians(coord.lng);
  const bearing = toRadians(angle);

  const newLat = Math.asin(Math.sin(lat) * Math.cos(distanceInRadians) + Math.cos(lat) * Math.sin(distanceInRadians) * Math.cos(bearing));
  const newLng = lng + Math.atan2(Math.sin(bearing) * Math.sin(distanceInRadians) * Math.cos(lat), Math.cos(distanceInRadians) - Math.sin(lat) * Math.sin(newLat));

  return new LngLat(toDegrees(newLng), toDegrees(newLat));
}

export function calculateDistScale(_map: mapboxgl.Map, c0: LngLat) {
  if (!_map) return 0;

  // Automatically calculate marker scale
  const newCoords = [
    getPointFromAngle(c0, 0, 1),      // N
    getPointFromAngle(c0, 90, 1),     // E
    getPointFromAngle(c0, 45, 1),     // NE
  ]
  const c0_projected = _map.project(c0);
  const distances = newCoords.map(c => _map.project(c).dist(c0_projected));
  const distScale = mean(distances);

  return distScale;
}