# osm.three.js
Custom implementation of viewer the vector-OSM (OpenStreetMap) files using `jquery` (reading xml) and `threejs` (visualize graphics).

# Using
Load your OSM-file to web-space in  https://georggrebenyuk.github.io/threeJS_sample/, and wait file's parsing. Enjoy!

# How OSM-file is readed?

1. Because all OSM's content are stored in WGS-84 coordinates (geodetic latitude and longitude) script convert original coordinates to Mercator's projection using [simple equations](https://wiki.openstreetmap.org/wiki/Mercator#JavaScript);
2. Each OSM file contains block 'bounds' where are stored BBox for data in file. Coordinates transforming to Mercator projection and calculated the center of BBox. The ThreeJS's Scene now placing in that center and all OSM-nodes coordinates are summarize with Center's coords x -1 (to getting as soon as smaller values);
3. There are three data types in OSM file: `node` (pointed-objects), `way` (linear or polygonal objects (if line is closed)) and `relation` (polygon with inner contour, mupltipolygon and other geometry collections). OSM elements are visuzlized if it's have at least one tag (properties); in other cases those elements using as auxiliary items for create geometry of other items;

Below lists a THREEJS's types for each case:
- node -> THREE.SphereGeometry();
- way (no closing) -> THREE.Line();
- way (closing, building = true)and relation (building = true) -> THREE.Mesh(THREE.ExtrudeGeometry());
- way (closing, building = false) -> THREE.Mesh(THREE.ShapeGeometry());


# TODO:

1. Adding internal material map (parse tags and getting material for that object's type);
2. Fix scene clipping throw camera (for large scenes);
3. Adding the procedure insted try/catch for checking, if outr polygon are contains the innr polygon;
4. The frame to show OSM's attributes of selected items (or items near cursor);
5. Possibility to load multiply files;