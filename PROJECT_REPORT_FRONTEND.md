# ABMVIZ Frontend Project Report
## Activity-Based Model Visualization System

---

## Executive Summary

ABMVIZ is an interactive web-based visualization platform for exploring and analyzing activity-based transportation models (ABM). The frontend provides multiple coordinated visualization techniques to represent complex origin-destination trip patterns, mode share analysis, zone-level demographics, and temporal activity distributions. This report documents the frontend architecture, technology stack, key features, and recent improvements made to the system.

---

## 1. Project Overview

### 1.1 Purpose
ABMVIZ enables transportation analysts, planners, and stakeholders to:
- Explore trip distributions across geographical zones and superdistricts
- Analyze transportation mode share by county and trip type
- Visualize temporal patterns of people not at home
- Examine origin-destination demand matrices
- Compare scenarios to inform transportation planning decisions

### 1.2 Target Users
- Transportation planners
- Public agencies (ARC - Atlanta Regional Commission)
- Policy makers
- Academic researchers
- General public interested in mobility patterns

### 1.3 Data Domain
The system visualizes activity-based model outputs from the Atlanta Regional Commission's multimodal transportation network, including:
- 78-79 superdistricts (traffic analysis zones)
- 21 counties in the greater Atlanta region
- Multiple trip categories (work, non-work, school transit, etc.)
- Four transportation modes (SOV, HOV, transit, and variants)
- Time-of-day periods

---

## 2. Technology Stack

### 2.1 Frontend Framework & Libraries

| Technology | Version | Purpose |
|-----------|---------|---------|
| **D3.js** | v3 & v4 | Core visualization engine, DOM manipulation, geospatial features |
| **Leaflet.js** | Latest | Interactive mapping library, tile layer management |
| **NVD3** | Latest | High-level D3 charts (bar charts, sparklines) |
| **jQuery** | 3.1.0 | DOM querying, event handling, AJAX |
| **Bootstrap** | 3.3.7 | Responsive grid layout, UI components |
| **Vue.js** | Latest (CDN) | Optional reactive data binding |
| **Chosen.js** | Latest | Searchable select dropdowns |
| **Bootstrap Slider** | Latest | Range input controls |
| **Spectrum.js** | Latest | Color picker widget |
| **Three.js** | Latest | 3D visualization rendering |
| **Stamen Maps** | Latest | Map tile provider (toner-lite theme) |

### 2.2 Data Formats
- **GeoJSON**: Zone and county geometries (ZoneShape.GeoJSON, cb_2015_us_county_500k_GEORGIA.json)
- **TopoJSON**: Superdistrict boundaries and desire line networks
- **CSV**: Tabular trip data, mode splits, demographics
- **JSON**: Configuration, scenario metadata

### 2.3 Server Technology
- Python 3.x simple HTTP server for local development
- Static file serving (no backend API required)

---

## 3. Frontend Architecture

### 3.1 Project Structure

```
src/
├── index.html                    # Main tabbed dashboard
├── load.js                       # Tab loading utilities
├── abmviz_utilities.js          # Shared utility functions
│
├── Visualizations/
│   ├── three3d.js              # 3D choropleth (Persons not at home)
│   ├── barchart_and_map.js      # Mode share by county (bar + map)
│   ├── grouped_barchart.js      # Grouped mode-share visualization
│   ├── od.js                    # Origin-destination desire lines
│   ├── radar.js                 # Multi-attribute radar charts
│   ├── sunburst.js              # Hierarchical sunburst (mode drill-down)
│   ├── timeuse.js               # Temporal activity patterns
│   └── transit.js               # Transit-specific visualization
│
├── Styles/
│   ├── style.css                # Global layout and theming
│   ├── barchart_and_map.css
│   ├── od.css
│   ├── three3d.css
│   ├── radar.css
│   └── [others].css
│
data/
├── scenarios.csv                # List of available scenarios
├── *.topojson                   # Superdistrict and county geometries
├── [scenario]/
│   ├── Desirelines.csv         # O-D trip matrix for scenario
│   └── BarChartAndMapData.csv  # County-level mode share data
```

### 3.2 Data Flow Architecture

```
HTML File (index.html)
    ↓
[Load.js - Tab Router]
    ↓
    ├→ three3d.js (loads ../data/Desirelines.csv + ZoneShape.GeoJSON)
    ├→ barchart_and_map.js (loads BarChartAndMapData.csv + county boundaries)
    ├→ od.js (loads Desirelines.csv + SuperDistrictsDesirelines.topojson)
    └→ [other viz modules]
    ↓
d3.queue() - Parallel Data Loading
    ↓
JSON/CSV Parsing
    ↓
In-Memory Data Structures (Objects/Arrays)
    ↓
D3/Leaflet Rendering
    ↓
Interactive DOM Elements (SVG + Canvas + HTML)
```

---

## 4. Core Components

### 4.1 Main Dashboard (index.html)

**Structure**: Tab-based interface with 8 visualization tabs

```
┌─────────────────────────────────────────┐
│  ABMVIZ | Scenario: MTP24_2040          │
├─────────────────────────────────────────┤
│ [Persons] [Grouped] [Trip Mode] [Time]  │
│ [Sunburst] [Radar] [Transit] [O&D] ←   │ Tabs
├─────────────────────────────────────────┤
│         [Active Tab Content]             │
│  [Map/Chart/3D Visualization]            │
├─────────────────────────────────────────┤
│ © ARC 2026 | Source Code (GitHub Link) │
└─────────────────────────────────────────┘
```

**Key Features**:
- Query parameter-based scenario selection: `?scenario=MTP24_2040`
- Lazy tab loading with localStorage state persistence
- Responsive Bootstrap grid layout
- Fixed navbar + footer
- Zoom-independent rendering

### 4.2 Persons Not At Home (three3d.js)

**Visualization Type**: 3D Choropleth with animated time periods

**Data Source**: 
- `[scenario]/3DAnimatedMapData.csv` (zone-level counts by time period)
- `data/ZoneShape.GeoJSON` (zone polygon boundaries)

**Features**:
- 3D extrusion based on data magnitude
- Color gradient classification (quartiles, Jenks breaks, even interval, custom)
- Time-period navigation (arrows)
- Interactive camera controls (pan, zoom, tilt, rotate)
- Centroid markers toggle
- Color ramp selection (Brewer palettes)
- Height normalized to global max for comparison across periods

**Technical Details**:
- Uses Three.js for 3D rendering
- D3 for geospatial projection and classification
- Geostats library for statistical breaks
- Safe property access: tries `feature.properties.id` then fallback to `MTAZ10`

### 4.3 Trip Mode by County (barchart_and_map.js)

**Visualization Type**: Dual synchronized bar chart + choropleth map

**Data Source**:
- `[scenario]/BarChartAndMapData.csv` (zone × mode × quantity)
- `data/cb_2015_us_county_500k_GEORGIA.json` (county boundaries)
- `data/ZoneShape.GeoJSON` (zone centroids for bubble markers)

**Components**:
1. **Horizontal Stacked Bar Chart** (NVD3):
   - Groups: counties
   - Segments: trip modes
   - Values: total trips
   - Interactive legend (toggle/isolate modes)

2. **Map Layer**:
   - County polygon outlines (weights highlight on hover)
   - Zone centroids as circle markers
   - Bubble size/color encode trip quantity
   - Layer toggle for choropleth vs. bubble view

**Key Interactions**:
- Click bar row → highlight county on map
- Hover county → bold outline + highlight bar
- Double-click legend → isolate single mode
- Click legend → toggle mode visibility
- Slider → adjust circle marker size
- Classification dropdown → redraw color scale

**Technical Solutions**:
- Safe property access for GeoJSON (handles missing/alt property names)
- Conditional filter for county layer (detects if properties exist)
- NVD3 chart integration with D3 sync
- Responsive layout: 50% chart (left) + 50% map (right)

### 4.4 Trip Origin-Destination (od.js)

**Visualization Type**: Desire line network on interactive map

**Data Sources**:
- `[scenario]/Desirelines.csv` (origin, destination, trip counts by mode)
- `data/SuperDistrictsDesirelines.topojson` (or `_plus210` variant with Dawson)
- `data/SuperDistricts.topojson` (superdistrict polygon outlines)
- `data/cb_2015_us_county_500k_GEORGIA.json` (county boundaries)

**Features**:
1. **Desire Lines**:
   - Line thickness encodes trip volume
   - Opacity encodes flow magnitude
   - Color: uniform but adjustable
   - Bidirectional flows summed for display

2. **Map Layers**:
   - Superdistrict boundaries (background)
   - County outlines (thin black lines)
   - Desire lines (foreground, interactive)

3. **Interaction Controls**:
   - Dropdown 1: Trip type (All / Work / Non-work)
   - Dropdown 2: Mode (All / SOV / HOV / Transit)
   - Slider: Line thickness scale (0-25)
   - Tooltip: Shows origin/destination names on hover

**Data Handling**:
- Flexible TopoJSON object key detection (handles `superdistricts` vs `transit`)
- Index-based name mapping: `nameByID[i+1]` for sequential access
- Dawson county injection via centroid proximity matching (if missing from topojson)
- Safe bilevel flow lookup: `od[o][d]` with default 0 if pair missing

**Recent Improvements**:
- Auto-tries `SuperDistrictsDesirelines_plus210.topojson` (with Dawson id=210) first
- Falls back to original file if enhanced version unavailable
- Detects GeometryCollection format for county fallback
- Arc decoding for TopoJSON coordinate reconstruction

### 4.5 Additional Visualizations

| Tab | Module | Type | Purpose |
|-----|--------|------|---------|
| **Grouped Data** | grouped_barchart.js | Grouped bar | Hierarchical mode breakdown |
| **Time Use** | timeuse.js | Heat map / areas | Activity distribution by hour |
| **Sunburst** | sunburst.js | Hierarchical sunburst | Drill-down: scenario→county→mode→trips |
| **Radar Charts** | radar.js | Radar / spider | Multi-attribute comparison across areas |
| **Transit** | transit.js | Route/mode specific | Transit-only analysis |

---

## 5. Data Processing & Integration

### 5.1 Scenario Selection Flow

```
user clicks scenario link
    ↓
index.html?scenario=MTP24_2040
    ↓
abmviz_utilities.GetURLParameter('scenario')
    ↓
each viz module loads ../data/[scenario]/[specific_data].csv
```

### 5.2 Geospatial Data Handling

**Zone Geometry (GeoJSON)**:
- 5,922 features representing fine-grained zones
- Properties: `id` OR fallback `MTAZ10` for zone identification
- Coordinate system: WGS84 (lat/lon)

**County Geometry (GeoJSON)**:
- Either FeatureCollection (with NAME properties) OR GeometryCollection (no properties)
- Code gracefully handles both formats
- Used for administrative boundary display and county-level filtering

**Superdistrict Boundaries (TopoJSON)**:
- Compressed arc representation (saves ~60% file size)
- Object key varies: `superdistricts` (old) or `transit` (new)
- Properties: `SD10` code (not strictly sequential, 1-201 range)
- Decoded on-the-fly using transform + scale/translate

### 5.3 Trip Data Matrices

**Desirelines.csv** format:
```
ORIG,DEST,WRKSOV,WRKHOV,WRKTRN,NWKSOV,...,ALLALL
1,2,20383,4476,57,...,73849
1,3,7267,1337,145,...,15308
...
78,78,0,0,0,...,0  ← self-loops included (filtered out in viz)
```

**BarChartAndMapData.csv** format:
```
ZONE,COUNTY,TRIP_MODE,QUANTITY
1,Fulton,BIKE,3
1,Fulton,DRIVEALONEFREE,680
...
```

---

## 6. Key Algorithms & Techniques

### 6.1 D3 Classification Methods

Used in three3d.js and barchart_and_map.js:

- **Quartiles**: 4 equal-frequency bins
- **Jenks Natural Breaks**: Identifies natural groupings (reduces within-class variance)
- **Even Interval**: Equal-width bins
- **Custom**: User-defined thresholds

Geostats.js library provides computation; D3 applies color scales.

### 6.2 Haversine Distance Calculation

Used in data generation (for desireline CSV):

```python
def haversine(lon1, lat1, lon2, lat2):
    R = 6371.0088  # Earth radius in km
    Δlon = lon2 - lon1
    Δlat = lat2 - lat1
    a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlon/2)
    c = 2·asin(√a)
    return R·c  # distance in km
```

### 6.3 Topological Arc Decoding

Old desirelines use TopoJSON arc references; decoding requires:

```javascript
for each arc reference [arc_idx1, arc_idx2, ...]:
    x = y = 0
    for each [dx, dy] in arcs[arc_idx]:
        x += dx; y += dy
        lon = x·scale[0] + translate[0]
        lat = y·scale[1] + translate[1]
        append [lon, lat] to coordinate list
```

### 6.4 Bidirectional Flow Aggregation

For O&D visualization, flows are summed both directions:

```javascript
stroke_width = scale(od[origin][dest] + od[dest][origin])
```

Handles asymmetric matrices by treating each direction pair.

---

## 7. Responsive Design & Accessibility

### 7.1 Layout Strategy

- **Navbar**: Fixed top, `navbar-inverse` theme
- **Main Container**: `container-fluid` for full-width
- **Tab Panes**: Dynamic height, overflow hidden for active pane only
- **Chart Area**: SVG elements scale with container width
- **Map Containers**: Fixed pixel height or viewport-relative
- **Footer**: Fixed bottom, dark background

### 7.2 Breakpoints (Bootstrap)

- **Desktop** (≥992px): 2-column layouts side-by-side
- **Tablet** (768-992px): Stacked layouts with reduced spacing
- **Mobile** (<768px): Single column, simplified interactions

### 7.3 Performance Optimizations

- **Lazy Loading**: Tabs load data only when clicked
- **LocalStorage**: Remembers last active tab
- **Deferred Scripts**: `defer` attribute on most JS imports
- **Geospatial Indexing**: D3 spatial methods for efficient hover/click
- **Canvas Rendering**: Three.js/WebGL for 3D (GPU acceleration)

---

## 8. Technical Challenges & Solutions

### Challenge 1: Inconsistent GeoJSON Property Names
**Problem**: Zone GeoJSON uses `MTAZ10` but code expected `id`; county file missing NAME properties.

**Solution**:
- Added fallback property checks: `feature.properties.id || feature.properties.MTAZ10`
- Conditional filtering: only filter by properties if they exist
- Try/catch with graceful degradation

### Challenge 2: TopoJSON Object Key Variability
**Problem**: Different superdistrict files use `superdistricts` vs `transit` object keys.

**Solution**:
- Dynamic key detection: `Object.keys(geo.objects)[0]` or explicit check for both keys
- Flexible feature extraction using resolved key

### Challenge 3: Dawson County Missing from Boundaries
**Problem**: Desire line network included Dawson (id 210) but polygon topojson did not.

**Solution**:
- Centroid proximity matching: search fallback county file for closest geometry
- If not found, use hard-coded centroid coordinates (-84.14, 34.43)
- Inject as synthetic feature with properties: `{NAME: 'Dawson', GEOID: 'Dawson'}`

### Challenge 4: Sequential vs Non-Sequential IDs
**Problem**: Topojson uses sparse SD10 codes (1-201) but desire lines expect 1-79.

**Solution**:
- Index-based mapping: `nameByID[i+1] = polygonName[i]` maps array position to sequential ID
- Lookups use index position, not SD10 code value

---

## 9. Current State & Recent Improvements

### 9.1 Completed Work

1. **Map Layer Robustness**
   - Added null-safety checks for property access
   - Conditional filtering for missing county properties
   - Bounds validation before fitting map

2. **Dawson County Integration**
   - Generated `Desirelines_from_SD_Table_plus210.csv` (80 superdistricts × 79 others = 6,320 lines)
   - Created `SuperDistrictsDesirelines_plus210.topojson` with id=210 geometry
   - Updated od.js to prioritize enhanced file with fallback

3. **Data Generation Pipeline**
   - `make_desirelines.py`: Reads SD_Table.csv, computes haversine distances, adds Dawson centroid
   - `make_desirelines_topo.py`: Converts CSV to TopoJSON/GeoJSON with proper property encoding

### 9.2 Known Issues & Pending Tasks

| Issue | Status | Impact |
|-------|--------|--------|
| 3DAnimatedMapData.csv incomplete (zones 1-9 only) | Open | 3D visualization shows partial data |
| County layer needs full 79-superdistrict polygon support | Partial | Dawson rendered via fallback |
| Browser testing of Dawson rendering | Pending | User verification needed |
| Old topojson files still in use by scenario folders | Partial | Need unified 79-zone deployment |

---

## 10. Deployment & Usage Notes

### 10.1 Running Locally

```bash
cd c:\Dashboard\Json\ABMVIZ_MTP25
py -3 -m http.server 8001
# Open http://localhost:8001/index.html
```

### 10.2 Selecting a Scenario

```
http://localhost:8001/index.html?scenario=MTP24_2040
```

Available scenarios (from `data/scenarios.csv`):
- MTP24_2020, MTP24_2030, MTP24_2033, MTP24_2040, MTP24_2050, MTP24_2050NB
- Archive: BASE2010, RP2015, RP2017, RP2020, RP2024, RP2030, RP2040, NB2040, RP-NB

### 10.3 Data File Dependencies

Each scenario folder must contain:
- `Desirelines.csv` (O-D matrix)
- `BarChartAndMapData.csv` (county-level mode share)
- `3DAnimatedMapData.csv` (zone-level time-of-day)

Shared data files (in root `data/` folder):
- `ZoneShape.GeoJSON` (35.5 MB)
- `SuperDistricts.topojson` / `_plus210` variant (2.6 MB)
- `SuperDistrictsDesirelines.topojson` / `_plus210` variant (varies)
- `cb_2015_us_county_500k_GEORGIA.json` (26.7 MB fallback)

---

## 11. Conclusions & Recommendations

### 11.1 Project Strengths

1. **Multi-method visualization**: Combines maps, charts, 3D, and hierarchical displays for rich exploration
2. **Scenario-based comparison**: Easy switching enables what-if analysis
3. **Coordinated interaction**: Hovering/clicking propagates across linked views
4. **Open-source stack**: D3, Leaflet, Bootstrap reduce vendor lock-in
5. **Responsive design**: Works across devices and screen sizes

### 11.2 Recommendations for Enhancement

1. **Backend API**: Introduce Node.js/Python API for on-demand aggregation (avoids large CSV loads)
2. **Data Caching**: Client-side IndexedDB or Service Workers for offline access
3. **Advanced Filtering**: Add temporal sliders, accessibility by demographics, mode-specific constraints
4. **Performance Tuning**: 
   - Virtualize large datasets (render only visible features)
   - WebWorkers for CSV parsing/aggregation
   - Reduce TopoJSON precision for faster downloads

5. **Accessibility**: 
   - Add ARIA labels
   - Keyboard navigation for all tabs
   - High-contrast color schemes
   - Screen reader support for charts

6. **Mobile UX**: 
   - Touch gestures for map (pinch-zoom, swipe tabs)
   - Simplified legends on small screens
   - Bottom sheet for controls (vs. overlays)

7. **Unit Testing**: 
   - Jest tests for utility functions
   - D3 selection testing
   - Mock data files for reproducible tests

---

## 12. References & Resources

- D3.js Documentation: https://d3js.org
- Leaflet.js Guide: https://leafletjs.com
- TopoJSON Format: https://github.com/topojson/topojson
- Bootstrap Grid System: https://getbootstrap.com/docs/3.3
- NVD3 Charts: http://nvd3.org
- Three.js 3D Graphics: https://threejs.org
- Atlanta Regional Commission: https://www.atlantaregional.com

---

**Report Prepared**: March 2026  
**Project**: ABMVIZ Frontend Architecture & Implementation  
**Context**: OMSA Practicum  
**Contact**: ARC Transportation Planning Division

