// Android draws no map (see NearbyMapView.js): the Nearby screen uses the
// device's location only, and never renders this.

import { forwardRef } from 'react';

const NearbyMapView = forwardRef(function NearbyMapView() {
  return null;
});

export default NearbyMapView;
