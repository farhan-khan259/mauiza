export const KAABA = { latitude: 21.4224779, longitude: 39.8251832 };
export const EARTH_RADIUS_KM = 6371.0088;
export const normalizeAngle = value => ((value % 360) + 360) % 360;
export const shortestArc = (target, current) => ((target - current + 540) % 360) - 180;
const rad = value => value * Math.PI / 180;
const deg = value => value * 180 / Math.PI;
export function qiblaBearing({ latitude, longitude }) {
  const p1 = rad(latitude), p2 = rad(KAABA.latitude), dl = rad(KAABA.longitude - longitude);
  return normalizeAngle(deg(Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl))));
}
export function qiblaDistance({ latitude, longitude }) {
  const p1 = rad(latitude), p2 = rad(KAABA.latitude), dp = p2 - p1, dl = rad(KAABA.longitude - longitude);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export const turnToQibla = (bearing, heading) => shortestArc(bearing, heading);
export const smoothHeading = (current, target) => current == null ? normalizeAngle(target) : normalizeAngle(current + shortestArc(target, current) * 0.2);
export function cardinalOffset(angle) {
  const cardinals = [{ a: 0, n: "North" }, { a: 90, n: "East" }, { a: 180, n: "South" }, { a: 270, n: "West" }, { a: 360, n: "North" }];
  const a = normalizeAngle(angle); const nearest = cardinals.reduce((best, item) => Math.abs(item.a - a) < Math.abs(best.a - a) ? item : best);
  const offset = Math.round(Math.abs(shortestArc(a, nearest.a)));
  if (!offset) return `Due ${nearest.n}`;
  const side = nearest.n === "North" || nearest.n === "South" ? (a < 180 ? "East" : "West") : (a > 90 && a < 270 ? "South" : "North");
  return `${offset}° ${side} of ${nearest.n}`;
}
