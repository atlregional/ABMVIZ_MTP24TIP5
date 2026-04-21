(function (d3, abmviz_utilities) {
  'use strict';

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
      if (obj[keys[i]] !== undefined && obj[keys[i]] !== null && obj[keys[i]] !== '') {
        return obj[keys[i]];
      }
    }
    return undefined;
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

    var scenario = abmviz_utilities.GetURLParameter('scenario');

    d3.queue()
      .defer(d3.csv, '../data/' + scenario + '/County_Desirelines.csv')
      .defer(d3.json, '../data/Counties.topojson')
      .defer(d3.json, '../data/County_Desirelines.topojson')
      .await(function (err, csv, countiesTopo, desirelinesTopo) {
        if (err) {
          console.error('County OD load failed:', err);
          return;
        }

        console.log('County OD CSV rows:', csv.length);

        var od = {};
        csv.forEach(function (row) {
          var o = normalizeFips(firstDefined(row, ['ORIG_FIPS', 'ORIG', 'o']));
          var d = normalizeFips(firstDefined(row, ['DEST_FIPS', 'DEST', 'd']));
          if (!o || !d) return;

          if (!od[o]) od[o] = {};

          if (o !== d) {
            od[o][d] = {
              WRKSOV: +row.WRKSOV || 0,
              WRKHOV: +row.WRKHOV || 0,
              WRKTRN: +row.WRKTRN || 0,
              NWKSOV: +row.NWKSOV || 0,
              NWKHOV: +row.NWKHOV || 0,
              NWKTRN: +row.NWKTRN || 0,
              ALLSOV: +row.ALLSOV || 0,
              ALLHOV: +row.ALLHOV || 0,
              ALLTRN: +row.ALLTRN || 0,
              WRKALL: +row.WRKALL || 0,
              NWKALL: +row.NWKALL || 0,
              ALLALL: +row.ALLALL || 0
            };
          }
        });

        var countyFeatures = [];
        if (countiesTopo.type === 'FeatureCollection') {
          countyFeatures = countiesTopo.features || [];
        } else if (countiesTopo.objects) {
          var countyKey = Object.keys(countiesTopo.objects)[0];
          countyFeatures = topojson.feature(countiesTopo, countiesTopo.objects[countyKey]).features;
        }

        var countyNameByFips = {};
        countyFeatures.forEach(function (f) {
          var p = f.properties || {};
          var fips = normalizeFips(firstDefined(p, ['FIPS', 'GEOID', 'COUNTYFP']));
          var name = firstDefined(p, ['NAME', 'name', 'County', 'COUNTY', 'NAMELSAD']) || fips;
          if (fips) countyNameByFips[fips] = name;
        });

        console.log('County FIPS sample:', Object.keys(countyNameByFips).slice(0, 5));
        console.log('OD sample:', Object.keys(od).slice(0, 5));

        var desireFeatures = [];
        if (desirelinesTopo.type === 'FeatureCollection') {
          desireFeatures = desirelinesTopo.features || [];
        } else if (desirelinesTopo.objects) {
          var desireKey = Object.keys(desirelinesTopo.objects)[0];
          desireFeatures = topojson.feature(desirelinesTopo, desirelinesTopo.objects[desireKey]).features;
        }

        desireFeatures.forEach(function (f) {
          var p = f.properties || {};
          p.o = normalizeFips(firstDefined(p, ['o', 'ORIG_FIPS', 'ORIG', 'Origin_FIPS', 'Origin_FIP']));
          p.d = normalizeFips(firstDefined(p, ['d', 'DEST_FIPS', 'DEST', 'Dest_FIPS', 'Destination_FIPS']));
          p.oName = firstDefined(p, ['oName', 'Origin_Cou', 'Origin_County']) || countyNameByFips[p.o] || p.o;
          p.dName = firstDefined(p, ['dName', 'Dest_Count', 'Dest_County']) || countyNameByFips[p.d] || p.d;
        });

        var map = L.map(containerID).setView([33.79, -84.35], 8);

        var baseLayers = {
          osm: L.tileLayer(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            {
              attribution: '&copy; OpenStreetMap contributors',
              maxZoom: 19
            }
          ),
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

        var initialBaseMap = 'osm';
        if (!d3.select('#countyOdBaseMap').empty()) {
          initialBaseMap = d3.select('#countyOdBaseMap').property('value') || 'osm';
        }
        setBaseMap(initialBaseMap);

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

        var countyPaths = g.selectAll('.county-polygons')
          .data(countyFeatures)
          .enter()
          .append('path')
          .attr('class', 'county-polygons')
          .attr('stroke', '#666')
          .attr('stroke-width', 1)
          .attr('fill', '#fff')
          .attr('fill-opacity', 0.35);

        var dataColumn = 'ALLALL';

        var lines = g.selectAll('.county-desirelines')
          .data(desireFeatures.filter(function (d) {
            return d.properties && d.properties.o && d.properties.d;
          }))
          .enter()
          .append('path')
          .attr('class', 'county-desirelines')
          .attr('stroke', '#d95f0e')
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
                d.properties.oName + ' → ' + d.properties.dName + ': ' + d3.format(',')(v1) + '<br>' +
                d.properties.dName + ' → ' + d.properties.oName + ': ' + d3.format(',')(v2)
              );
          })
          .on('mousemove', function () {
            tooltip
              .style('top', (d3.event.pageY - 16) + 'px')
              .style('left', (d3.event.pageX + 12) + 'px');
          })
          .on('mouseout', function () {
            d3.select(this).style('cursor', 'default');
            tooltip.style('opacity', 0);
          });

        function updateTransform() {
          if (!countyFeatures.length) return;

          var bounds = path.bounds({ type: 'FeatureCollection', features: countyFeatures });
          var buffer = 100;
          var topLeft = [bounds[0][0] - buffer, bounds[0][1] - buffer];
          var bottomRight = [bounds[1][0] + buffer, bounds[1][1] + buffer];

          mapsvg
            .attr('width', bottomRight[0] - topLeft[0])
            .attr('height', bottomRight[1] - topLeft[1])
            .style('left', topLeft[0] + 'px')
            .style('top', topLeft[1] + 'px');

          g.attr('transform', 'translate(' + (-topLeft[0]) + ',' + (-topLeft[1]) + ')');

          countyPaths.attr('d', path);
          lines.attr('d', path);
        }

        function updateDesireLines() {
          var tripType = d3.select('#countyOdTripType').property('value') || 'all';
          var mode = d3.select('#countyOdMode').property('value') || 'all';
          dataColumn = (tripType + mode).toUpperCase();

          var dataMax = getMax(od, dataColumn);
          if (!dataMax || dataMax < 1) dataMax = 1;

          w.domain([0, dataMax]);
          op.domain([0, dataMax]);

          lines
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
            });
        }

        d3.selectAll('.countyOdInput').on('change', updateDesireLines);

        if (!d3.select('#countyOdBaseMap').empty()) {
          d3.select('#countyOdBaseMap').on('change', function () {
            setBaseMap(d3.select(this).property('value'));
          });
        }

        var mySlider = $('#countyOdSlider').bootstrapSlider();
        mySlider.on('slideStop', function () {
          w.range([0, mySlider.bootstrapSlider('getValue')]);
          updateDesireLines();
        });

        map.on('viewreset', updateTransform);
        map.on('movestart', function () {
          mapsvg.classed('hidden', true);
        });
        map.on('moveend', function () {
          updateTransform();
          mapsvg.classed('hidden', false);
        });

        $('a[href="#CountyOandD"]').on('shown.bs.tab', function () {
          redrawMap(map, countyFeatures, updateTransform, updateDesireLines);
        });

        updateTransform();
        updateDesireLines();

        if ($('#CountyOandD').hasClass('active')) {
          redrawMap(map, countyFeatures, updateTransform, updateDesireLines);
        }
      });
  })();
}(d3v4, abmviz_utilities));