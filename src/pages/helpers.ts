import { LngLat } from 'mapbox-gl';

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

export async function getAlpha(src: string, maxWidth: number = 64, maxHeight: number = 64): Promise<string> {
  try {
    // Fetch the image from the source
    const response = await fetch(src, { mode: 'cors' });
    const blob = await response.blob();

    // Create an image bitmap from the blob
    const imgBitmap = await createImageBitmap(blob);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Calculate the scale factor to resize the image
    const scaleWidth = maxWidth / imgBitmap.width;
    const scaleHeight = maxHeight / imgBitmap.height;
    const scale = Math.min(scaleWidth, scaleHeight, 1); // Ensure the scale is not more than 1

    // Set canvas size based on the scale
    canvas.width = imgBitmap.width * scale;
    canvas.height = imgBitmap.height * scale;

    // Draw and scale the image bitmap onto the canvas
    ctx.drawImage(imgBitmap, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Invert alpha and convert to grayscale
    for (let i = 0; i < data.length; i += 4) {
      const invertedAlpha = 255 - data[i + 3];
      data[i] = invertedAlpha; // Red
      data[i + 1] = invertedAlpha; // Green
      data[i + 2] = invertedAlpha; // Blue
      data[i + 3] = 255; // Alpha
    }

    ctx.putImageData(imageData, 0, 0);

    // Convert the canvas to a data URL
    console.log("a");
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.log("b");
    throw error;
  }
}