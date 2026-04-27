(function (d3, abmviz_utilities) {
  'use strict';

  function asId(v) {
    if (v === undefined || v === null || v === '') return null;
    var s = String(v).trim();
    s = s.replace(/^=(?:"([^"]+)"|(.+))$/, '$1$2');
    s = s.replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '');
    if (/^\d+\.0+$/.test(s)) s = String(parseInt(s, 10));
    return s;
  }

  function normalizeFips(v) {
    var s = asId(v);
    if (!s) return null;
    return s.padStart(5, '0');
  }

  function firstDefined(obj, keys) {
    for (var i = 0; i < keys.length; i += 1) {
      if (
        obj[keys[i]] !== undefined &&
        obj[keys[i]] !== null &&
        obj[keys[i]] !== ''
      ) {
        return obj[keys[i]];
      }
    }
    return undefined;
  }

  function getNumericValue(obj, keys) {
    for (var i = 0; i < keys.length; i += 1) {
      var v = obj[keys[i]];
      if (v !== undefined && v !== null && v !== '') {
        var n = +v;
        if (!isNaN(n)) return n;
      }
    }
    return null;
  }

  function prettyLabel(col) {
    var labels = {
      ALLALL: 'All Trips',
      WRKALL: 'Work Trips',
      NWKALL: 'Non-Work Trips',
      ALLSOV: 'All SOV',
      ALLHOV: 'All HOV',
      ALLTRN: 'All Transit',
      ALLWALK: 'All Walk',
      ALLBIKE: 'All Bike'
    };

    return labels[col] || col.replace(/_/g, ' ');
  }

  function getMax(data, currentVar) {
    var max = 0;

    Object.keys(data).forEach(function (o) {
      Object.keys(data[o]).forEach(function (d) {
        var a = (data[o] && data[o][d] && data[o][d][currentVar]) || 0;
        var b = (data[d] && data[d][o] && data[d][o][currentVar]) || 0;
        max = Math.max(max, a + b);
      });
    });

    return max;
  }

  function redrawMap(map, countyFeatures, updateTransform, updateDesireLines) {
    map.invalidateSize();

    if (countyFeatures && countyFeatures.length) {
      var tempLayer = L.geoJson(countyFeatures);
      var bounds = tempLayer.getBounds();

      if (bounds && bounds.isValid()) {
        map.fitBounds(bounds);
      }
    }

    setTimeout(function () {
      map.invalidateSize();
      updateTransform();
      updateDesireLines();
    }, 100);
  }

  (function createCountyOD() {
    var containerID = 'countyOdMap';
    var maxLineWidthPixels = 10;

    var w = d3.scaleLinear().range([0, maxLineWidthPixels]);
    var op = d3.scaleLinear().range([0.15, 1]);

    var palette = [
      [
        '#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6',
        '#4292c6', '#2171b5', '#08519c', '#08306b', '#041b33'
      ],
      [
        '#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c',
        '#fc4e2a', '#e31a1c', '#bd0026', '#800026', '#4d0025'
      ],
      [
        '#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476',
        '#41ab5d', '#238b45', '#006d2c', '#00441b', '#002510'
      ],
      [
        '#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a',
        '#ef3b2c', '#cb181d', '#a50f15', '#67000d', '#3f0008'
      ],
      [
        '#041b33', '#08306b', '#08519c', '#2171b5', '#4292c6',
        '#6baed6', '#9ecae1', '#c6dbef', '#deebf7', '#f7fbff'
      ],
      [
        '#ffffd9', '#edf8b1', '#c7e9b4', '#7fcdbb', '#41b6c4',
        '#1d91c0', '#225ea8', '#253494', '#081d58', '#081d58'
      ]
    ];

    var currentPaletteIndex = 1;
    var colorScale = d3.scaleQuantize().range(palette[currentPaletteIndex]);

    var scenario = abmviz_utilities.GetURLParameter('scenario') || '';
    var scenarioPath = scenario ? '../data/' + scenario + '/' : '../data/';

    var csvPath =
      scenarioPath +
      'county_desirelines.csv?v=' +
      encodeURIComponent(scenario || 'default') +
      '&t=' +
      Date.now();

    var countiesPath = scenarioPath + 'counties.topojson?v=' + Date.now();
    var desirelinesPath =
      scenarioPath + 'county_desirelines.topojson?v=' + Date.now();

    function loadWithCallback(loader, path, allowMissing) {
      return new Promise(function (resolve, reject) {
        loader(path, function (err, data) {
          if (err) {
            if (allowMissing) {
              resolve(null);
            } else {
              reject(err);
            }
          } else {
            resolve(data);
          }
        });
      });
    }

    function loadJson(path, allowMissing) {
      return loadWithCallback(d3.json, path, allowMissing);
    }

    function loadTopoJsonWithFallback(path, fallbackPath, allowMissingFallback) {
      return loadJson(path, true).then(function (data) {
        return data || loadJson(fallbackPath, allowMissingFallback);
      });
    }

    function buildPaletteSelector(updateDesireLines) {
      var ramp = d3.select('#countyOdColorRamp');

      if (ramp.empty()) return;

      ramp.selectAll('*').remove();

      var items = ramp
        .selectAll('.county-od-ramp')
        .data(palette)
        .enter()
        .append('div')
        .attr('class', 'county-od-ramp')
        .style('display', 'inline-block')
        .style('margin', '2px')
        .style('cursor', 'pointer')
        .style('border', function (d, i) {
          return i === currentPaletteIndex
            ? '2px solid black'
            : '1px solid #ccc';
        })
        .on('click', function (d, i) {
          currentPaletteIndex = i;
          colorScale.range(palette[currentPaletteIndex]);

          d3.selectAll('.county-od-ramp')
            .style('border', function (x, j) {
              return j === currentPaletteIndex
                ? '2px solid black'
                : '1px solid #ccc';
            });

          updateDesireLines();
        });

      items
        .selectAll('span')
        .data(function (d) {
          return d;
        })
        .enter()
        .append('span')
        .style('display', 'inline-block')
        .style('width', '12px')
        .style('height', '14px')
        .style('background-color', function (d) {
          return d;
        });
    }

    var loadData = Promise.all([
      loadWithCallback(d3.csv, csvPath, false),
      loadTopoJsonWithFallback(
        countiesPath,
        '../data/counties.topojson?v=' + Date.now(),
        false
      ),
      loadTopoJsonWithFallback(
        desirelinesPath,
        '../data/county_desirelines.topojson?v=' + Date.now(),
        true
      )
    ]);

    loadData.then(function (results) {
      var csv = results[0];
      var countiesTopo = results[1];
      var desirelinesTopo = results[2];

      if (!csv || !csv.length) {
        console.error('County OD CSV is empty.');
        return;
      }

      var idColumns = {
        ORIG_FIPS: true,
        DEST_FIPS: true,
        origin_county: true,
        destination_county: true,
        Origin_Long: true,
        Origin_Lat: true,
        Dest_Long: true,
        Dest_Lat: true,
        od_id: true
      };

      var numericColumns = csv.columns.filter(function (col) {
        if (idColumns[col]) return false;

        return csv.some(function (row) {
          var v = row[col];
          return v !== undefined && v !== null && v !== '' && !isNaN(+v);
        });
      });

      if (!numericColumns.length) {
        console.error('No numeric columns found in county_desirelines.csv.');
        return;
      }

      var defaultColumn =
        numericColumns.indexOf('ALLALL') >= 0 ? 'ALLALL' : numericColumns[0];

      var dropdown = d3.select('#countyOdAttribute');

      if (dropdown.empty()) {
        console.error('countyOdAttribute dropdown not found in HTML.');
        return;
      }

      dropdown.classed('countyOdInput', true);
      dropdown.selectAll('option').remove();

      dropdown
        .selectAll('option')
        .data(numericColumns)
        .enter()
        .append('option')
        .attr('value', function (d) {
          return d;
        })
        .property('selected', function (d) {
          return d === defaultColumn;
        })
        .text(function (d) {
          return prettyLabel(d);
        });

      var od = {};

      csv.forEach(function (row) {
        var o = normalizeFips(
          firstDefined(row, ['ORIG_FIPS', 'origin_fips', 'ORIG', 'o'])
        );

        var d = normalizeFips(
          firstDefined(row, ['DEST_FIPS', 'destination_fips', 'DEST', 'd'])
        );

        if (!o || !d || o === d) return;

        if (!od[o]) od[o] = {};
        od[o][d] = {};

        numericColumns.forEach(function (col) {
          od[o][d][col] = +row[col] || 0;
        });

        od[o][d].origin_county =
          firstDefined(row, ['origin_county', 'oName', 'Origin_County']) || o;

        od[o][d].destination_county =
          firstDefined(row, ['destination_county', 'dName', 'Destination_County']) || d;
      });

      var countyFeatures = [];

      if (countiesTopo.type === 'FeatureCollection') {
        countyFeatures = countiesTopo.features || [];
      } else if (countiesTopo.objects) {
        var countyKey = Object.keys(countiesTopo.objects)[0];
        countyFeatures = topojson.feature(
          countiesTopo,
          countiesTopo.objects[countyKey]
        ).features;
      }

      var countyNameByFips = {};

      countyFeatures.forEach(function (f) {
        var p = f.properties || {};
        var fips = normalizeFips(firstDefined(p, ['FIPS', 'GEOID', 'COUNTYFP']));
        var name =
          firstDefined(p, ['NAME', 'name', 'County', 'COUNTY', 'NAMELSAD']) ||
          fips;

        if (fips) countyNameByFips[fips] = name;
      });

      var desireFeatures = [];

      if (desirelinesTopo) {
        if (desirelinesTopo.type === 'FeatureCollection') {
          desireFeatures = desirelinesTopo.features || [];
        } else if (desirelinesTopo.objects) {
          var desireKey = Object.keys(desirelinesTopo.objects)[0];
          desireFeatures = topojson.feature(
            desirelinesTopo,
            desirelinesTopo.objects[desireKey]
          ).features;
        }
      }

      if (!desireFeatures.length) {
        desireFeatures = csv
          .map(function (row) {
            var o = normalizeFips(
              firstDefined(row, ['ORIG_FIPS', 'origin_fips', 'ORIG', 'o'])
            );

            var d = normalizeFips(
              firstDefined(row, ['DEST_FIPS', 'destination_fips', 'DEST', 'd'])
            );

            var origLon = getNumericValue(row, [
              'Origin_Long',
              'origin_long',
              'Orig_Long'
            ]);

            var origLat = getNumericValue(row, [
              'Origin_Lat',
              'origin_lat',
              'Orig_Lat'
            ]);

            var destLon = getNumericValue(row, [
              'Dest_Long',
              'dest_long',
              'Dest_Long'
            ]);

            var destLat = getNumericValue(row, [
              'Dest_Lat',
              'dest_lat',
              'Dest_Lat'
            ]);

            if (
              !o ||
              !d ||
              o === d ||
              origLon === null ||
              origLat === null ||
              destLon === null ||
              destLat === null
            ) {
              return null;
            }

            return {
              type: 'Feature',
              properties: {
                o: o,
                d: d,
                oName:
                  firstDefined(row, ['origin_county', 'oName', 'Origin_County']) ||
                  countyNameByFips[o] ||
                  o,
                dName:
                  firstDefined(row, [
                    'destination_county',
                    'dName',
                    'Destination_County'
                  ]) ||
                  countyNameByFips[d] ||
                  d
              },
              geometry: {
                type: 'LineString',
                coordinates: [
                  [origLon, origLat],
                  [destLon, destLat]
                ]
              }
            };
          })
          .filter(function (f) {
            return f !== null;
          });
      }

      if (window.countyOdMapInstance) {
        window.countyOdMapInstance.off();
        window.countyOdMapInstance.remove();
        window.countyOdMapInstance = null;
      }

      var mapContainer = document.getElementById(containerID);

      if (!mapContainer) {
        console.error('County OD map container not found:', containerID);
        return;
      }

      $('#' + containerID).empty();

      var map = L.map(containerID).setView([33.79, -84.35], 8);
      window.countyOdMapInstance = map;

      var baseLayers = {
        osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19
        }),

        esri: L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
          {
            attribution: 'Tiles &copy; Esri',
            maxZoom: 16
          }
        ),

        carto: L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
          {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
          }
        )
      };

      var currentBaseLayer = null;

      function setBaseMap(layerName) {
        if (!baseLayers[layerName]) return;

        if (currentBaseLayer && map.hasLayer(currentBaseLayer)) {
          map.removeLayer(currentBaseLayer);
        }

        currentBaseLayer = baseLayers[layerName];
        currentBaseLayer.addTo(map);
      }

      setBaseMap(d3.select('#countyOdBaseMap').property('value') || 'osm');

      if (L.Control && L.Control.Fullscreen) {
        map.addControl(new L.Control.Fullscreen());
      }

      var mapsvg = d3.select(map.getPanes().overlayPane).append('svg');
      var g = mapsvg.append('g');
      var tooltip = d3.select('#countyOdTooltip');

      function projectPoint(x, y) {
        var point = map.latLngToLayerPoint(new L.LatLng(y, x));
        this.stream.point(point.x, point.y);
      }

      var transform = d3.geoTransform({ point: projectPoint });
      var path = d3.geoPath().projection(transform);

      var countyPaths = g
        .selectAll('.county-polygons')
        .data(countyFeatures)
        .enter()
        .append('path')
        .attr('class', 'county-polygons')
        .attr('stroke', '#666')
        .attr('stroke-width', 1)
        .attr('fill', '#fff')
        .attr('fill-opacity', 0.35);

      var dataColumn = defaultColumn;

      var lines = g
        .selectAll('.county-desirelines')
        .data(
          desireFeatures.filter(function (d) {
            return d.properties && d.properties.o && d.properties.d;
          })
        )
        .enter()
        .append('path')
        .attr('class', 'county-desirelines')
        .attr('stroke', palette[currentPaletteIndex][5])
        .attr('stroke-linecap', 'round')
        .style('fill', 'none')
        .style('stroke-width', 0)
        .style('pointer-events', 'visibleStroke')
        .on('mouseover', function (d) {
          d3.select(this).style('cursor', 'pointer');

          var o = d.properties.o;
          var dest = d.properties.d;

          var v1 = (od[o] && od[o][dest] && od[o][dest][dataColumn]) || 0;
          var v2 = (od[dest] && od[dest][o] && od[dest][o][dataColumn]) || 0;

          tooltip
            .style('opacity', 1)
            .html(
              '<strong>' +
                prettyLabel(dataColumn) +
                '</strong><br>' +
                d.properties.oName +
                ' → ' +
                d.properties.dName +
                ': ' +
                d3.format(',')(v1) +
                '<br>' +
                d.properties.dName +
                ' → ' +
                d.properties.oName +
                ': ' +
                d3.format(',')(v2) +
                '<br><strong>Total:</strong> ' +
                d3.format(',')(v1 + v2)
            );
        })
        .on('mousemove', function () {
          tooltip
            .style('top', d3.event.pageY - 16 + 'px')
            .style('left', d3.event.pageX + 12 + 'px');
        })
        .on('mouseout', function () {
          d3.select(this).style('cursor', 'default');
          tooltip.style('opacity', 0);
        });

      function updateTransform() {
        if (!countyFeatures.length) return;

        var bounds = path.bounds({
          type: 'FeatureCollection',
          features: countyFeatures
        });

        var buffer = 100;
        var topLeft = [bounds[0][0] - buffer, bounds[0][1] - buffer];
        var bottomRight = [bounds[1][0] + buffer, bounds[1][1] + buffer];

        mapsvg
          .attr('width', bottomRight[0] - topLeft[0])
          .attr('height', bottomRight[1] - topLeft[1])
          .style('left', topLeft[0] + 'px')
          .style('top', topLeft[1] + 'px');

        g.attr(
          'transform',
          'translate(' + -topLeft[0] + ',' + -topLeft[1] + ')'
        );

        countyPaths.attr('d', path);
        lines.attr('d', path);
      }

      function updateDesireLines() {
        dataColumn =
          d3.select('#countyOdAttribute').property('value') || defaultColumn;

        var dataMax = getMax(od, dataColumn);

        if (!dataMax || dataMax < 1) {
          dataMax = 1;
        }

        w.domain([0, dataMax]);
        op.domain([0, dataMax]);
        colorScale.domain([0, dataMax]);

        lines
          .interrupt()
          .transition()
          .duration(300)
          .style('stroke-width', function (d) {
            var o = d.properties.o;
            var dest = d.properties.d;

            var a = (od[o] && od[o][dest] && od[o][dest][dataColumn]) || 0;
            var b = (od[dest] && od[dest][o] && od[dest][o][dataColumn]) || 0;

            return w(a + b);
          })
          .style('stroke-opacity', function (d) {
            var o = d.properties.o;
            var dest = d.properties.d;

            var a = (od[o] && od[o][dest] && od[o][dest][dataColumn]) || 0;
            var b = (od[dest] && od[dest][o] && od[dest][o][dataColumn]) || 0;

            return op(a + b);
          })
          .attr('stroke', function (d) {
            var o = d.properties.o;
            var dest = d.properties.d;

            var a = (od[o] && od[o][dest] && od[o][dest][dataColumn]) || 0;
            var b = (od[dest] && od[dest][o] && od[dest][o][dataColumn]) || 0;

            return colorScale(a + b);
          });
      }

      buildPaletteSelector(updateDesireLines);

      d3.selectAll('#countyOdAttribute, .countyOdInput').on(
        'change',
        updateDesireLines
      );

      d3.select('#countyOdBaseMap').on('change', function () {
        setBaseMap(d3.select(this).property('value'));
      });

      var mySlider = $('#countyOdSlider');

      if (mySlider.length && mySlider.bootstrapSlider) {
        mySlider.bootstrapSlider();

        mySlider.off('slideStop');
        mySlider.on('slideStop', function () {
          w.range([0, mySlider.bootstrapSlider('getValue')]);
          updateDesireLines();
        });
      }

      map.on('viewreset zoomend moveend', updateTransform);

      map.on('movestart', function () {
        mapsvg.classed('hidden', true);
      });

      map.on('moveend', function () {
        updateTransform();
        mapsvg.classed('hidden', false);
      });

      $('a[href="#CountyOandD"]')
        .off('shown.bs.tab.countyod')
        .on('shown.bs.tab.countyod', function () {
          redrawMap(map, countyFeatures, updateTransform, updateDesireLines);
        });

      updateTransform();
      updateDesireLines();

      if ($('#CountyOandD').hasClass('active')) {
        redrawMap(map, countyFeatures, updateTransform, updateDesireLines);
      }
    });
  })();
})(d3v4, abmviz_utilities);