// Retrying a photo that never arrived. Pure, so scripts/test-photoretry.js can
// check it in plain node.
//
// React Native's Android network client has no read timeout, so a photo request
// caught in a dropped connection can hang for good: neither onLoad nor onError
// ever fires and the viewer would spin for ever. Two things get the player out:
//
//   • after SLOW_PHOTO_MS a still-loading photo offers Retry beside its spinner
//     (it is not declared broken — a big photo on a slow line is just slow);
//   • a retry asks for the same photo under a new cache key.
//
// The cache key is the point. The image pipeline merges requests for a URI it
// is already fetching, so asking again for the very same URI joins the hung
// request instead of starting a new one. A URL fragment changes the key without
// changing what is fetched: fragments never leave the device, so the server
// sees exactly the URL it always did.

export const SLOW_PHOTO_MS = 12000;

export function retryUri(uri, attempt) {
  if (!uri || !attempt || !/^https?:\/\//i.test(uri)) return uri;
  const hash = uri.indexOf('#');
  const base = hash < 0 ? uri : uri.slice(0, hash);
  return `${base}#retry-${attempt}`;
}
