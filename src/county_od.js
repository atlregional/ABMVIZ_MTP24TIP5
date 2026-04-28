(function (d3, abmviz_utilities) {
  'use strict';

  (function createCountyOD() {
    var divID = 'countyOd';
    var containerID = 'countyOdMap';

    var selectedColorRampIndex = 1;
    var maxLineWidth = 10;
    var currentTileLayer;
    var countyLineLayer;
    var selectedAttribute = 'ALLALL';

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

    var scenario = abmviz_utilities.GetURLParameter('scenario');
    var csvPath = '../data/' + scenario + '/county_desirelines.csv';
    var countiesPath = '../data/' + scenario + '/counties.topojson';
    var fallbackCountiesPath = '../data/counties.topojson';
    var desirelinesPath = '../data/' + scenario + '/county_desirelines.topojson';
    var fallbackDesirelinesPath = '../data/county_desirelines.topojson';

    function normalizeFips(v) {
      if (v === undefined || v === null || v === '') return null;
      var s = String(v).trim();
      if (/^\d+\.0+$/.test(s)) s = String(parseInt(s, 10));
      return s.padStart(5, '0');
    }

    function firstDefined(obj, keys) {
      for (var i = 0; i < keys.length; i += 1) {
        if (obj[keys[i]] !== undefined && obj[keys[i]] !== null && obj[keys[i]] !== '') {
          return obj[keys[i]];
        }
      }
      return undefined;
    }

    function prettyLabel(col) {
      var labels = {
        ALLALL: 'All Trips',
        WRKALL: 'Work Trips',
        NWKALL: 'Non-Work Trips',
        ALLSOV: 'SOV',
        ALLHOV: 'HOV',
        ALLTRN: 'Transit',
        ALLWALK: 'Walk',
        ALLBIKE: 'Bike'
      };

      return labels[col] || col;
    }

    function formatNumber(num) {
      return Math.round(num || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function loadWithFallback(loader, mainPath, fallbackPath, callback) {
      loader(mainPath, function(err, data) {
        if (!err && data) {
          callback(null, data);
          return;
        }

        if (!fallbackPath) {
          callback(err, null);
          return;
        }

        loader(fallbackPath, function(err2, data2) {
          callback(err2, data2);
        });
      });
    }

    function getTopoFeatures(topo) {
      if (!topo) return [];

      if (topo.type === 'FeatureCollection') {
        return topo.features || [];
      }

      if (topo.objects) {
        var key = topo.objects.transit ? 'transit' : Object.keys(topo.objects)[0];
        return topojson.feature(topo, topo.objects[key]).features || [];
      }

      return [];
    }

    function getClassColor(value, breaks) {
      if (value === null || value === undefined || isNaN(value)) {
        return '#f0f0f0';
      }

      for (var i = 0; i < breaks.length - 1; i += 1) {
        if (value <= breaks[i + 1] || i === breaks.length - 2) {
          return palette[selectedColorRampIndex][i];
        }
      }

      return palette[selectedColorRampIndex][palette[selectedColorRampIndex].length - 1];
    }

    function getLineWeight(value, maxValue) {
      if (!maxValue || maxValue <= 0 || !value) return 0;
      return Math.max(0.5, (value / maxValue) * maxLineWidth);
    }

    function getBidirectionalValue(feature, odData) {
      var p = feature.properties || {};
      var o = normalizeFips(firstDefined(p, ['o', 'ORIG_FIPS', 'ORIG']));
      var d = normalizeFips(firstDefined(p, ['d', 'DEST_FIPS', 'DEST']));

      var a = odData[o] && odData[o][d] ? odData[o][d][selectedAttribute] || 0 : 0;
      var b = odData[d] && odData[d][o] ? odData[d][o][selectedAttribute] || 0 : 0;

      return a + b;
    }

    function getDirectionalValue(odData, o, d) {
      return odData[o] && odData[o][d] ? odData[o][d][selectedAttribute] || 0 : 0;
    }

    function buildBreaks(values) {
      var validValues = values.filter(function(v) {
        return v !== null && v !== undefined && !isNaN(v) && v > 0;
      });

      if (!validValues.length) {
        return [0, 1];
      }

      var serie = new geostats(validValues);

      try {
        return serie.getClassJenks(10);
      } catch (e) {
        var max = d3.max(validValues);
        return d3.range(0, 11).map(function(i) {
          return (max / 10) * i;
        });
      }
    }

    function updateLegend(breaks) {
      var legendDiv = d3.select('#countyOdLegend');

      if (legendDiv.empty()) return;

      legendDiv.html('');

      if (!breaks || breaks.length < 2) {
        legendDiv.text('No legend available');
        return;
      }

      var rectWidth = 110;
      var li = { h: 32, s: 5, r: 3 };
      var totalLegendWidth = (breaks.length - 1) * (rectWidth + li.s);

      var legend = legendDiv
        .append('svg')
        .attr('width', totalLegendWidth)
        .attr('height', li.h);

      var legendGroups = legend
        .selectAll('g')
        .data(d3.range(breaks.length - 1))
        .enter()
        .append('g')
        .attr('transform', function(d, i) {
          return 'translate(' + i * (rectWidth + li.s) + ',0)';
        });

      legendGroups
        .append('rect')
        .attr('rx', li.r)
        .attr('ry', li.r)
        .attr('width', rectWidth)
        .attr('height', li.h)
        .style('fill', function(d, i) {
          return palette[selectedColorRampIndex][i];
        });

      legendGroups
        .append('text')
        .attr('x', rectWidth / 2)
        .attr('y', li.h / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'middle')
        .style('fill', 'white')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text(function(d, i) {
          return formatNumber(breaks[i]) + ' - ' + formatNumber(breaks[i + 1]);
        });
    }

    function buildPaletteSelector(updateStyle) {
      var rampContainer = d3.select('#countyOdColorRamp');

      if (rampContainer.empty()) return;

      rampContainer.selectAll('*').remove();

      var rampClasses = ['Blues', 'Oranges', 'Greens', 'Reds', 'ReversedBlues', 'Teals'];

      palette.forEach(function(ramp, i) {
        var rampDiv = rampContainer
          .append('div')
          .attr('class', 'ramp ' + rampClasses[i] + (i === selectedColorRampIndex ? ' selected' : ''))
          .style('display', 'inline-block')
          .style('cursor', 'pointer')
          .style('margin', '2px')
          .style('border', i === selectedColorRampIndex ? '2px solid black' : '1px solid #ccc')
          .on('click', function() {
            d3.selectAll('#countyOdColorRamp .ramp')
              .classed('selected', false)
              .style('border', '1px solid #ccc');

            d3.select(this)
              .classed('selected', true)
              .style('border', '2px solid black');

            selectedColorRampIndex = i;
            updateStyle();
          });

        var svg = rampDiv.append('svg').attr('width', 60).attr('height', 15);
        var colors = ramp.slice(0, 4);

        colors.forEach(function(color, j) {
          svg
            .append('rect')
            .attr('fill', color)
            .attr('width', 15)
            .attr('height', 15)
            .attr('x', j * 15);
        });
      });
    }

    function initMap(csv, countiesTopo, desirelinesTopo) {
      if (!csv || !csv.length) {
        console.error('No county OD records loaded');
        d3.select('#' + divID).remove();
        return;
      }

      var numericColumns = csv.columns.filter(function(col) {
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

        if (idColumns[col]) return false;

        return csv.some(function(row) {
          return row[col] !== undefined && row[col] !== null && row[col] !== '' && !isNaN(+row[col]);
        });
      });

      if (!numericColumns.length) {
        console.error('No numeric columns found in county_desirelines.csv');
        d3.select('#' + divID).remove();
        return;
      }

      selectedAttribute = numericColumns.indexOf('ALLALL') >= 0 ? 'ALLALL' : numericColumns[0];

      var attributeSelect = d3.select('#countyOdAttribute');
      attributeSelect.selectAll('option').remove();

      attributeSelect
        .selectAll('option')
        .data(numericColumns)
        .enter()
        .append('option')
        .attr('value', function(d) { return d; })
        .property('selected', function(d) { return d === selectedAttribute; })
        .text(function(d) { return prettyLabel(d); });

      var odData = {};

      csv.forEach(function(row) {
        var o = normalizeFips(firstDefined(row, ['ORIG_FIPS', 'origin_fips', 'ORIG', 'o']));
        var d = normalizeFips(firstDefined(row, ['DEST_FIPS', 'destination_fips', 'DEST', 'd']));

        if (!o || !d || o === d) return;

        if (!odData[o]) odData[o] = {};
        odData[o][d] = {};

        numericColumns.forEach(function(col) {
          odData[o][d][col] = +row[col] || 0;
        });

        odData[o][d].origin_county = firstDefined(row, ['origin_county', 'oName', 'Origin_County']) || o;
        odData[o][d].destination_county = firstDefined(row, ['destination_county', 'dName', 'Destination_County']) || d;
      });

      var countyFeatures = getTopoFeatures(countiesTopo);
      var countyNameByFips = {};

      countyFeatures.forEach(function(f) {
        var p = f.properties || {};
        var fips = normalizeFips(firstDefined(p, ['FIPS', 'GEOID', 'COUNTYFP']));
        var name = firstDefined(p, ['NAME', 'name', 'County', 'COUNTY', 'NAMELSAD']) || fips;

        if (fips) countyNameByFips[fips] = name;
      });

      var desireFeatures = getTopoFeatures(desirelinesTopo);

      if (!desireFeatures.length) {
        desireFeatures = csv.map(function(row) {
          var o = normalizeFips(firstDefined(row, ['ORIG_FIPS', 'origin_fips', 'ORIG', 'o']));
          var d = normalizeFips(firstDefined(row, ['DEST_FIPS', 'destination_fips', 'DEST', 'd']));

          var origLon = +firstDefined(row, ['Origin_Long', 'origin_long', 'Orig_Long']);
          var origLat = +firstDefined(row, ['Origin_Lat', 'origin_lat', 'Orig_Lat']);
          var destLon = +firstDefined(row, ['Dest_Long', 'dest_long', 'Dest_Long']);
          var destLat = +firstDefined(row, ['Dest_Lat', 'dest_lat', 'Dest_Lat']);

          if (!o || !d || o === d || isNaN(origLon) || isNaN(origLat) || isNaN(destLon) || isNaN(destLat)) {
            return null;
          }

          return {
            type: 'Feature',
            properties: {
              o: o,
              d: d,
              oName: firstDefined(row, ['origin_county', 'oName', 'Origin_County']) || countyNameByFips[o] || o,
              dName: firstDefined(row, ['destination_county', 'dName', 'Destination_County']) || countyNameByFips[d] || d
            },
            geometry: {
              type: 'LineString',
              coordinates: [
                [origLon, origLat],
                [destLon, destLat]
              ]
            }
          };
        }).filter(function(f) {
          return f !== null;
        });
      }

      desireFeatures.forEach(function(f) {
        var p = f.properties || {};

        p.o = normalizeFips(firstDefined(p, ['o', 'ORIG_FIPS', 'ORIG']));
        p.d = normalizeFips(firstDefined(p, ['d', 'DEST_FIPS', 'DEST']));

        p.oName = firstDefined(p, ['oName', 'origin_county', 'Origin_County']) || countyNameByFips[p.o] || p.o;
        p.dName = firstDefined(p, ['dName', 'destination_county', 'Destination_County']) || countyNameByFips[p.d] || p.d;
      });

      if (window.countyOdMapInstance) {
        window.countyOdMapInstance.off();
        window.countyOdMapInstance.remove();
        window.countyOdMapInstance = null;
      }

      $('#' + containerID).empty();

      var map = L.map(containerID).setView([33.792902, -84.349885], 8);
      window.countyOdMapInstance = map;

      currentTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
        subdomains: ['a', 'b', 'c']
      }).addTo(map);

      if (L.Control && L.Control.Fullscreen) {
        map.addControl(new L.Control.Fullscreen());
      }

      var countiesLayer = L.geoJSON(countyFeatures, {
        style: function() {
          return {
            fillColor: '#ffffff',
            weight: 1,
            opacity: 1,
            color: '#777',
            fillOpacity: 0.2
          };
        }
      }).addTo(map);

      function getCurrentValues() {
        return desireFeatures.map(function(feature) {
          return getBidirectionalValue(feature, odData);
        });
      }

      function getCurrentMax() {
        var values = getCurrentValues();
        return d3.max(values) || 1;
      }

      function getCurrentBreaks() {
        return buildBreaks(getCurrentValues());
      }

      function updateStyle() {
        var maxValue = getCurrentMax();
        var breaks = getCurrentBreaks();

        updateLegend(breaks);

        countyLineLayer.setStyle(function(feature) {
          var value = getBidirectionalValue(feature, odData);

          return {
            color: getClassColor(value, breaks),
            weight: getLineWeight(value, maxValue),
            opacity: value > 0 ? 0.85 : 0,
            lineCap: 'round'
          };
        });
      }

      countyLineLayer = L.geoJSON(desireFeatures, {
        style: function(feature) {
          var value = getBidirectionalValue(feature, odData);
          var maxValue = getCurrentMax();
          var breaks = getCurrentBreaks();

          return {
            color: getClassColor(value, breaks),
            weight: getLineWeight(value, maxValue),
            opacity: value > 0 ? 0.85 : 0,
            lineCap: 'round'
          };
        },
        onEachFeature: function(feature, layer) {
          layer.on('mouseover', function() {
            var p = feature.properties || {};
            var o = p.o;
            var d = p.d;

            var v1 = getDirectionalValue(odData, o, d);
            var v2 = getDirectionalValue(odData, d, o);

            layer.bindTooltip(
              '<strong>' + prettyLabel(selectedAttribute) + '</strong><br/>' +
              p.oName + ' → ' + p.dName + ': ' + formatNumber(v1) + '<br/>' +
              p.dName + ' → ' + p.oName + ': ' + formatNumber(v2) + '<br/>' +
              '<strong>Total:</strong> ' + formatNumber(v1 + v2),
              { sticky: true }
            ).openTooltip();
          });
        }
      }).addTo(map);

      if (countiesLayer.getBounds && countiesLayer.getBounds().isValid()) {
        map.fitBounds(countiesLayer.getBounds());
      } else if (countyLineLayer.getBounds && countyLineLayer.getBounds().isValid()) {
        map.fitBounds(countyLineLayer.getBounds());
      }

      setTimeout(function() {
        map.invalidateSize();
      }, 200);

      attributeSelect.on('change', function() {
        selectedAttribute = this.value;
        updateStyle();
      });

      $('#countyOdSlider').bootstrapSlider({
        formatter: function(value) {
          return 'Line thickness: ' + value;
        }
      }).on('slideStop', function(ev) {
        maxLineWidth = ev.value;
        updateStyle();
      });

      $('#countyOdBaseMap').on('change', function() {
        var value = this.value;

        if (currentTileLayer) {
          map.removeLayer(currentTileLayer);
        }

        if (value === 'osm') {
          currentTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19,
            subdomains: ['a', 'b', 'c']
          });
        } else if (value === 'esri') {
          currentTileLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
            {
              attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
              maxZoom: 16
            }
          );
        } else if (value === 'carto') {
          currentTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
          });
        }

        currentTileLayer.addTo(map);
      });

      buildPaletteSelector(updateStyle);
      updateStyle();

      $('a[href="#CountyOandD"]')
        .off('shown.bs.tab.countyod')
        .on('shown.bs.tab.countyod', function() {
          setTimeout(function() {
            map.invalidateSize();

            if (countiesLayer.getBounds && countiesLayer.getBounds().isValid()) {
              map.fitBounds(countiesLayer.getBounds());
            }

            updateStyle();
          }, 200);
        });
    }

    Promise.all([
      d3.csv(csvPath),
      new Promise((resolve, reject) => loadWithFallback(d3.json, countiesPath, fallbackCountiesPath, (err, data) => err ? reject(err) : resolve(data))),
      new Promise((resolve, reject) => loadWithFallback(d3.json, desirelinesPath, fallbackDesirelinesPath, (err, data) => err ? reject(err) : resolve(data)))
    ]).then(([csv, countiesTopo, desirelinesTopo]) => {
      initMap(csv, countiesTopo, desirelinesTopo);
    }).catch(err => {
      console.error('Error loading County OD data:', err);
      d3.select('#' + divID).remove();
    });
  })();

})(d3, abmviz_utilities);