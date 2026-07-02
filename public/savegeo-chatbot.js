/* ── SaveGeo Chatbot Widget ─────────────────────────────────────
   Agentic AI chat for SaveGeo. Calls POST /api/agent/control,
   reads SaveGeo global state, executes whitelisted UI actions.
────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ─── Config ─────────────────────────────────────────────────── */
  var AGENT_ENDPOINT = '/agent/control';

  var CHAT_I18N = {
    id: {
      welcome: 'Halo, saya SaveGeo Assistant. Saya bisa membantu membaca peta, menjelaskan fitur, memilih dataset, menjalankan analisis, dan membuat ringkasan. Gambar AOI di peta atau tanyakan apa yang ingin dianalisis.',
      quickActions: [
        { label: 'Analisis Lengkap',     msg: 'Tolong lakukan analisis lengkap area ini' },
        { label: 'Gunakan AOI Ini',      msg: 'Gunakan AOI yang sedang aktif di peta' },
        { label: 'Analisis Karbon',      msg: 'Tolong analisis stok karbon area ini' },
        { label: 'Tutupan Lahan',        msg: 'Tolong analisis tutupan lahan area ini' },
        { label: 'Bandingkan Perubahan', msg: 'Tolong bandingkan perubahan tutupan lahan' },
        { label: 'Buat Laporan',         msg: 'Tolong buat executive summary dari hasil analisis' },
      ],
    },
    en: {
      welcome: 'Hi, I am SaveGeo Assistant. I can help read the map, explain features, choose datasets, run analyses, and prepare summaries. Draw an AOI on the map or ask what you want to analyze.',
      quickActions: [
        { label: 'Full Analysis',    msg: 'Please run a full analysis for this area' },
        { label: 'Use This AOI',     msg: 'Use the active AOI on the map' },
        { label: 'Carbon Analysis',  msg: 'Please analyze carbon stock for this area' },
        { label: 'Land Cover',       msg: 'Please analyze land cover for this area' },
        { label: 'Compare Changes',  msg: 'Please compare land cover changes' },
        { label: 'Create Report',    msg: 'Please create an executive summary from the analysis results' },
      ],
    },
  };

  function chatLang() {
    return localStorage.getItem('savegeo_language') === 'en' ? 'en' : 'id';
  }

  function chatText(key) {
    return (CHAT_I18N[chatLang()] && CHAT_I18N[chatLang()][key]) || CHAT_I18N.id[key] || '';
  }

  /* ─── Access SaveGeo lexical globals ────────────────────────── */
  /* Variables declared with let/var inside index.html's script are
     not on window. This helper bridges both cases safely.          */
  function getAppValue(name, fallback) {
    try {
      if (name === 'currentAOI'           && typeof currentAOI           !== 'undefined') return currentAOI;
      if (name === 'drawnItems'           && typeof drawnItems           !== 'undefined') return drawnItems;
      if (name === 'map'                  && typeof map                  !== 'undefined') return map;
      if (name === 'L'                    && typeof L                    !== 'undefined') return L;
      if (name === 'geeTileLayers'        && typeof geeTileLayers        !== 'undefined') return geeTileLayers;
      if (name === 'activeResultLayerName'&& typeof activeResultLayerName!== 'undefined') return activeResultLayerName;
      if (name === 'analysisResults'      && typeof analysisResults      !== 'undefined') return analysisResults;
      if (name === 'API_BASE_URL'         && typeof API_BASE_URL         !== 'undefined') return API_BASE_URL;
      if (name === 'config'               && typeof config               !== 'undefined') return config;
    } catch (e) { /* silent — lexical scope miss */ }
    return window[name] != null ? window[name] : fallback;
  }

  /* ─── Context adapter ────────────────────────────────────────── */
  var SaveGeoContext = {
    getActiveAOI: function () {
      var aoi = getAppValue('currentAOI', null);
      if (aoi && aoi.geojson) return aoi.geojson;
      var drawn = getAppValue('drawnItems', null);
      if (drawn && typeof drawn.toGeoJSON === 'function') {
        var fc = drawn.toGeoJSON();
        if (fc && fc.features && fc.features.length > 0) return fc;
      }
      return null;
    },
    getActiveAOIName: function () {
      var aoi = getAppValue('currentAOI', null);
      return (aoi && aoi.name) ? aoi.name : null;
    },
    getCurrentYear: function () {
      var sp = document.getElementById('yearValue');
      if (sp && sp.textContent.trim()) { var v = parseInt(sp.textContent.trim()); if (!isNaN(v)) return v; }
      var sl = document.getElementById('yearSlider');
      if (sl && sl.value) { var s = parseInt(sl.value); if (!isNaN(s)) return s; }
      return new Date().getFullYear();
    },
    addMapLayer: function (layer) {
      var m = getAppValue('map', null);
      var Lf = getAppValue('L', null);
      if (!m || !Lf) return false;
      try {
        var url = layer.url || layer.tile_url;
        if (!url) return false;
        var name = layer.name || ('chatbot_layer_' + Date.now());
        var tl = Lf.tileLayer(url, { opacity: layer.opacity != null ? layer.opacity : 0.8, maxZoom: 20 });
        tl.addTo(m);
        var layers = getAppValue('geeTileLayers', null);
        if (layers) layers[name] = tl;
        return true;
      } catch (e) { console.warn('SaveGeoChatbot: addMapLayer failed', e); }
      return false;
    },
  };

  /* ─── Page state collector ───────────────────────────────────── */
  function getPageState() {
    var ar = getAppValue('analysisResults', {}) || {};

    /* Available options from DOM */
    function optionValues(id) {
      var el = document.getElementById(id);
      if (!el) return [];
      return Array.from(el.options).map(function (o) { return o.value; }).filter(Boolean);
    }

    /* Detect active module from .active class */
    var currentModule = 'carbon';
    ['carbon', 'lc-change', 'disaster', 'details', 'about', 'guide'].forEach(function (m) {
      var el = document.getElementById('module-' + m);
      if (el && el.classList.contains('active')) currentModule = m.replace('-', '_');
    });

    var hasCarbon = !!(ar.carbon && (ar.carbon.carbon_estimated || ar.carbon.tile_url));
    var hasLandcover = !!(ar.landcover && Object.keys(ar.landcover).length > 0);
    var hasVegetation = !!(ar.vegetation);
    var hasTransition = !!(ar.landcover_transition);

    /* Extract key numeric values for AI narration */
    var carbonData = ar.carbon || {};
    var carbonStats = carbonData.statistics || carbonData.stats || {};
    var vegData = ar.vegetation || {};
    var vegStats = vegData.statistics || vegData.stats || {};

    return {
      current_module:              currentModule,
      has_aoi:                     !!SaveGeoContext.getActiveAOI(),
      aoi_name:                    SaveGeoContext.getActiveAOIName(),
      selected_year:               SaveGeoContext.getCurrentYear(),
      selected_carbon_dataset:     (document.getElementById('carbonReferenceDataset') || {}).value || null,
      selected_carbon_model:       (document.getElementById('carbonModelSelect') || {}).value || null,
      available_carbon_datasets:   optionValues('carbonReferenceDataset'),
      available_carbon_models:     optionValues('carbonModelSelect'),
      available_landcover_datasets:optionValues('landcoverDatasetSelect'),
      analysis_results: {
        carbon:     hasCarbon,
        landcover:  hasLandcover,
        vegetation: hasVegetation,
        transition: hasTransition,
        carbon_data: hasCarbon ? {
          carbon_estimated:  carbonData.carbon_estimated   || null,
          total_carbon:      carbonData.total_carbon       || null,
          carbon_unit:       carbonData.carbon_unit        || carbonData.unit || null,
          area_ha:           carbonData.area_ha            || null,
          model_r2:          carbonData.model_r2           || null,
          target_pool:       carbonData.target_pool        || null,
          dataset_name:      carbonData.dataset_name       || carbonData.reference_dataset || null,
          statistics:        Object.keys(carbonStats).length ? carbonStats : null,
        } : null,
        vegetation_data: hasVegetation ? {
          indices:    vegData.indices || Object.keys(vegData).filter(function(k){ return k !== 'tile_url' && k !== 'statistics'; }),
          statistics: Object.keys(vegStats).length ? vegStats : null,
        } : null,
      },
    };
  }

  /* ─── Screenshot capture ─────────────────────────────────────── */
  /* Dynamically loads html2canvas, captures #map div, returns base64 PNG
     (no data-URL prefix). Cross-origin tiles may render as blank — AOI
     and analysis overlays (SVG) are captured correctly.               */
  function captureMapScreenshot() {
    return new Promise(function (resolve, reject) {
      function doCapture() {
        var mapEl = document.getElementById('map');
        if (!mapEl) { reject(new Error('Elemen peta (#map) tidak ditemukan.')); return; }
        window.html2canvas(mapEl, {
          allowTaint:  true,
          useCORS:     true,
          logging:     false,
          scale:       window.devicePixelRatio || 1,
        }).then(function (canvas) {
          /* strip "data:image/png;base64," prefix */
          var dataUrl = canvas.toDataURL('image/png');
          resolve(dataUrl.replace(/^data:image\/png;base64,/, ''));
        }).catch(reject);
      }

      if (window.html2canvas) { doCapture(); return; }
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload  = doCapture;
      s.onerror = function () { reject(new Error('Gagal memuat html2canvas.')); };
      document.head.appendChild(s);
    });
  }

  /* ─── API client ─────────────────────────────────────────────── */
  var ChatbotAPI = {
    baseUrl: function () {
      var base = getAppValue('API_BASE_URL', null);
      if (typeof base === 'string' && base) return base.replace(/\/+$/, '');
      var cfg = getAppValue('config', null);
      if (cfg && cfg.api && cfg.api.baseUrl) return String(cfg.api.baseUrl).replace(/\/+$/, '');
      return 'http://localhost:8086/api';
    },
    send: function (message, imageB64, fileObj, sessionId, signal) {
      var url     = this.baseUrl() + AGENT_ENDPOINT;
      var payload = { message: message, page_state: getPageState() };
      if (imageB64)   payload.image      = imageB64;
      if (sessionId)  payload.session_id = sessionId;
      if (fileObj) {
        payload.attachment = {
          name:      fileObj.name,
          mime_type: fileObj.mime_type,
          text:      fileObj.text  || null,
          b64:       fileObj.b64   || null,
        };
      }
      return fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal:  signal || null,
      }).then(function (res) {
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (e) {
            throw new Error(e.error || ('HTTP ' + res.status));
          });
        }
        return res.json();
      });
    },
  };

  /* ─── Action executor ────────────────────────────────────────── */
  var ActionExecutor = {
    chatbot: null,   // set by SaveGeoChatbot._runActions before each run

    /* Run an array of actions sequentially, call onDone when complete */
    run: function (actions, onStep, onDone) {
      var queue = (actions || []).filter(function (a) {
        return a.type !== 'ask_user' && a.type !== 'explain';
      });
      var self = this;
      function next(i) {
        if (i >= queue.length) { if (onDone) onDone(); return; }
        var action = queue[i];
        if (onStep) onStep(action, i, queue.length);
        self._dispatch(action, function () { setTimeout(function () { next(i + 1); }, 350); });
      }
      next(0);
    },

    _dispatch: function (action, cb) {
      switch (action.type) {
        case 'switch_module':      this._switchModule(action.module, cb);              break;
        case 'set_value':          this._setValue(action.target, action.value, cb);    break;
        case 'run_analysis':       this._runAnalysis(action.analysis, cb);             break;
        case 'show_result_layer':  this._showLayer(action.layer, cb);                  break;
        case 'download_report':    this._downloadReport(action.report, cb);            break;
        case 'fly_to':             this._flyTo(action, cb);                            break;
        case 'set_aoi_geocode':    this._setAOIGeocode(action, cb);                   break;
        case 'guide_step':         this._guideStep(action, cb);                        break;
        case 'highlight_ui':       this._highlightUI(action, cb);                      break;
        case 'request_file_aoi':   this._requestFileAOI(action, cb);                  break;
        case 'open_draw_tool':     this._openDrawTool(action, cb);                     break;
        case 'offer_choices':              this._offerChoices(action, cb);                    break;
        case 'download_boundary_geojson':  this._downloadBoundaryGeoJSON(action, cb);        break;
        default:                   cb();
      }
    },

    _switchModule: function (module, cb) {
      /* Map spec names → switchModule() argument */
      var MAP = { carbon:'carbon', landcover:'carbon', lc_change:'lc-change',
                  disaster:'disaster', details:'details', about:'about', guide:'guide' };
      var target = MAP[module] || module;
      if (typeof window.switchModule === 'function') {
        window.switchModule(target);
      } else {
        var btn = document.getElementById('menu-' + target);
        if (btn) btn.click();
      }
      /* "landcover" = carbon module + set analysisType */
      if (module === 'landcover') {
        setTimeout(function () {
          var el = document.getElementById('analysisType');
          if (el) { el.value = 'landcover'; if (window.$) $(el).trigger('change'); }
          cb();
        }, 350);
      } else {
        setTimeout(cb, 350);
      }
    },

    _setValue: function (target, value, cb) {
      function jqChange(el) { if (el && window.$) $(el).trigger('change'); }
      function setInput(id, v) { var el = document.getElementById(id); if (el) { el.value = v; jqChange(el); } return !!el; }
      function firstOf() { for (var i=0;i<arguments.length;i++){var el=document.getElementById(arguments[i]);if(el)return el;} return null; }

      switch (target) {
        case 'year':
          var sl = document.getElementById('yearSlider');
          var sp = document.getElementById('yearValue');
          if (sl) { sl.value = value; if (window.$) $(sl).trigger('input').trigger('change'); }
          if (sp) sp.textContent = value;
          break;
        case 'start_month':
          var el = firstOf('startMonth','carbonStartMonth','lcStartMonth'); if (el) { el.value=value; jqChange(el); } break;
        case 'end_month':
          el = firstOf('endMonth','carbonEndMonth','lcEndMonth'); if (el) { el.value=value; jqChange(el); } break;
        case 'cloud_threshold':
          el = firstOf('cloudSlider','carbonCloudSlider'); if (el) { el.value=value; if(window.$)$(el).trigger('input').trigger('change'); } break;
        case 'carbon_reference_dataset': setInput('carbonReferenceDataset', value); break;
        case 'carbon_dataset_year':      setInput('carbonDatasetYear', value);      break;
        case 'carbon_model':             setInput('carbonModelSelect', value);      break;
        case 'carbon_scale':             setInput('carbonScale', value);            break;
        case 'carbon_clip_mode':
          document.querySelectorAll('input[name="carbonClipMode"]').forEach(function (r) { if (r.value === value) r.click(); });
          break;
        case 'enable_carbon_delta':
          var chk = document.getElementById('enableCarbonDelta');
          if (chk && chk.checked !== !!value) chk.click();
          break;
        case 'carbon_delta_start_year':  setInput('carbonDeltaStartYear', value); break;
        case 'carbon_delta_end_year':    setInput('carbonDeltaEndYear', value);   break;
        case 'carbon_delta_interval':    setInput('carbonDeltaInterval', value);  break;
        case 'landcover_datasets':
        case 'landcover_dataset':
          el = document.getElementById('landcoverDatasetSelect');
          if (el && window.$) { $(el).val(Array.isArray(value) ? value : [value]).trigger('change'); }
          break;
        case 'transition_dataset':    setInput('transitionDataset', value);    break;
        case 'transition_start_year': setInput('transitionStartYear', value);  break;
        case 'transition_end_year':   setInput('transitionEndYear', value);    break;
        case 'vegetation_indices':
          var vals = (Array.isArray(value) ? value : [value]).map(function (v) { return v.toUpperCase(); });
          document.querySelectorAll('.index-badge').forEach(function (badge) {
            var idx = badge.getAttribute('data-index') || '';
            var want = vals.indexOf(idx.toUpperCase()) !== -1;
            var has  = badge.classList.contains('active');
            if (want !== has) badge.click();
          });
          break;
        case 'province': el=document.getElementById('provinceSelect'); if(el&&window.$)$(el).val(value).trigger('change'); break;
        case 'city':     el=document.getElementById('citySelect');     if(el&&window.$)$(el).val(value).trigger('change'); break;
        case 'district': el=document.getElementById('districtSelect'); if(el&&window.$)$(el).val(value).trigger('change'); break;
        case 'village':  el=document.getElementById('villageSelect');  if(el&&window.$)$(el).val(value).trigger('change'); break;
      }
      cb();
    },

    _runAnalysis: function (analysis, cb) {
      function clickRunBtn() {
        var btn = document.getElementById('runAnalysis');
        if (btn) btn.click();
      }
      function setType(v) {
        var el = document.getElementById('analysisType');
        if (el) { el.value = v; if (window.$) $(el).trigger('change'); }
      }

      /* Register one-shot hook so cb() fires only after analysis truly finishes.
         Fallback: 3-minute timeout in case the hook never fires (error path). */
      var fired = false;
      var fallback = setTimeout(function () {
        if (!fired) { fired = true; window._onSaveGeoAnalysisDone = null; cb(); }
      }, 180000);
      window._onSaveGeoAnalysisDone = function () {
        if (!fired) {
          fired = true;
          clearTimeout(fallback);
          window._onSaveGeoAnalysisDone = null;
          setTimeout(cb, 300);
        }
      };

      switch (analysis) {
        case 'carbon':
          setType('carbon');
          setTimeout(clickRunBtn, 200);
          break;
        case 'carbon_delta':
          var chk = document.getElementById('enableCarbonDelta');
          if (chk && !chk.checked) chk.click();
          setTimeout(function () { setType('carbon'); setTimeout(clickRunBtn, 200); }, 350);
          break;
        case 'landcover':
          setType('landcover');
          setTimeout(clickRunBtn, 200);
          break;
        case 'vegetation':
          setType('vegetation');
          setTimeout(clickRunBtn, 200);
          break;
        case 'complete':
          setType('combined');
          setTimeout(clickRunBtn, 200);
          break;
        case 'landcover_transition':
        case 'landcover_change_map':
          /* lc_change module has its own run button */
          var lcBtn = document.getElementById('runLcTransition') ||
                      document.getElementById('runTransitionAnalysis') ||
                      document.querySelector('#module-lc-change .btn-primary[id*="run"], #module-lc-change .btn-success[id*="run"]');
          if (lcBtn) {
            lcBtn.click();
          } else if (window.LCChange && typeof window.LCChange.runAnalysis === 'function') {
            window.LCChange.runAnalysis();
          }
          break;
        default:
          clickRunBtn();
      }
      /* NOTE: cb() is NOT called here — it fires via _onSaveGeoAnalysisDone hook */
    },

    _showLayer: function (layer, cb) {
      if (typeof window.switchResultLayer === 'function') {
        try { window.switchResultLayer(layer); } catch (e) { console.warn('switchResultLayer failed', e); }
      }
      cb();
    },

    _downloadReport: function (report, cb) {
      switch (report) {
        case 'executive_summary':
          if (typeof window.downloadExecutiveSummary === 'function') window.downloadExecutiveSummary();
          else { var b=document.getElementById('exportExecSummary'); if(b) b.click(); }
          break;
        case 'statistics_json':
          if (typeof window.downloadStatistics === 'function') window.downloadStatistics();
          else { var b=document.getElementById('downloadStats'); if(b) b.click(); }
          break;
        case 'geotiff':
          if (typeof window.exportToGoogleDrive === 'function') window.exportToGoogleDrive();
          else { var b=document.getElementById('exportGeoTIFF'); if(b) b.click(); }
          break;
      }
      cb();
    },

    /* ── Map control actions ───────────────────────────────────── */

    _flyTo: function (action, cb) {
      function doFly(lat, lng, zoom, bbox) {
        if (typeof window.flyToLocation === 'function') {
          window.flyToLocation(lat, lng, zoom, bbox);
        } else {
          var map = getAppValue('map', null);
          if (map) {
            if (bbox) map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]], { padding: [30, 30] });
            else map.flyTo([lat, lng], zoom || 12, { duration: 1.5 });
          }
        }
        cb();
      }

      if (action.lat && action.lng) {
        doFly(action.lat, action.lng, action.zoom || 12, null);
      } else if (action.query) {
        var url = ChatbotAPI.baseUrl() + '/utils/geocode?q=' + encodeURIComponent(action.query);
        fetch(url)
          .then(function (r) { return r.json(); })
          .then(function (d) { if (d.lat) doFly(d.lat, d.lng, 12, d.bbox); else cb(); })
          .catch(function () { cb(); });
      } else {
        cb();
      }
    },

    _setAOIGeocode: function (action, cb) {
      var query = action.query || '';
      var url   = ChatbotAPI.baseUrl() + '/utils/geocode?q=' + encodeURIComponent(query);

      fetch(url)
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.lat) { cb(); return; }

          var ai   = d.address_info || {};
          var isID = ai.country_code === 'id';

          // Prefer admin dropdown (accurate boundary) for Indonesia locations
          if (isID && ai.province && typeof window.setAOIByAdminName === 'function') {
            window.setAOIByAdminName(ai.province, ai.city || '', ai.district || '', ai.village || '').then(function (ok) {
              if (!ok && d.bbox && typeof window.setAOIFromGeoJSON === 'function') {
                // Province not found in dropdown — fallback to bbox polygon
                var b = d.bbox;
                var feature = {
                  type: 'Feature',
                  geometry: { type: 'Polygon', coordinates: [[
                    [b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]],[b[0],b[1]],
                  ]] },
                  properties: { name: d.display_name || query },
                };
                window.setAOIFromGeoJSON(feature, d.display_name || query);
              }
              cb();
            });
            return;
          }

          // Non-Indonesia or no admin info — use bbox polygon on map
          if (d.bbox && typeof window.setAOIFromGeoJSON === 'function') {
            var b = d.bbox;
            var feature = {
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: [[
                [b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]],[b[0],b[1]],
              ]] },
              properties: { name: d.display_name || query },
            };
            window.setAOIFromGeoJSON(feature, d.display_name || query);
          } else if (typeof window.flyToLocation === 'function') {
            window.flyToLocation(d.lat, d.lng, 12, d.bbox);
          }
          cb();
        })
        .catch(function () { cb(); });
    },

    _guideStep: function (action, cb) {
      var step  = action.step  || 1;
      var total = action.total || 1;
      var title = action.title || '';
      var body  = action.body  || '';
      var pct   = Math.round((step / total) * 100);

      var div = document.createElement('div');
      div.className = 'sgc-guide-step';
      div.innerHTML =
        '<div class="sgc-guide-header">' +
          '<span class="sgc-guide-badge">Langkah ' + step + ' / ' + total + '</span>' +
          '<span class="sgc-guide-title">' + escapeHtml(title) + '</span>' +
        '</div>' +
        '<div class="sgc-guide-progress"><div class="sgc-guide-bar" style="width:' + pct + '%"></div></div>' +
        '<div class="sgc-guide-body">' + renderMarkdown(body) + '</div>';

      var msgs = document.getElementById('sgc-messages');
      if (msgs) msgs.appendChild(div);
      setTimeout(function () {
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
        cb();
      }, 100);
    },

    _highlightUI: function (action, cb) {
      var id = action.element_id || '';
      var el = id ? document.getElementById(id) : null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('sgc-highlight-pulse');
        setTimeout(function () { el.classList.remove('sgc-highlight-pulse'); }, 3500);
      }
      cb();
    },

    _requestFileAOI: function (action, cb) {
      var hint = action.hint || 'Upload file AOI (.geojson / .json).';
      // Change file input to accept geojson
      var fi = document.getElementById('sgc-file-input');
      if (fi) fi.setAttribute('accept', '.geojson,.json,.kml');
      cb();
      // Message shown via AI's "message" field — no extra bubble needed
    },

    _openDrawTool: function (action, cb) {
      var btn = document.getElementById('drawAOI') ||
                document.querySelector('[data-action="draw-aoi"]') ||
                document.querySelector('.leaflet-draw-draw-polygon') ||
                document.querySelector('.draw-polygon-btn');
      if (btn) btn.click();
      cb();
    },

    _offerChoices: function (action, cb) {
      var chatbot = ActionExecutor.chatbot;
      var choices = action.choices || [];
      if (!choices.length) { cb(); return; }

      var wrap = document.createElement('div');
      wrap.className = 'sgc-choice-card';

      if (action.question) {
        var q = document.createElement('div');
        q.className   = 'sgc-choice-question';
        q.textContent = action.question;
        wrap.appendChild(q);
      }

      var row = document.createElement('div');
      row.className = 'sgc-choice-row';
      choices.forEach(function (c) {
        var btn = document.createElement('button');
        btn.className   = 'sgc-choice-btn';
        btn.textContent = c.label || c.msg;
        btn.addEventListener('click', function () {
          wrap.querySelectorAll('.sgc-choice-btn').forEach(function (b) { b.disabled = true; });
          btn.classList.add('selected');
          if (chatbot) chatbot._handleSend(c.msg);
        });
        row.appendChild(btn);
      });
      wrap.appendChild(row);

      var msgsEl = document.getElementById('sgc-messages');
      if (msgsEl) {
        var msgEl = document.createElement('div');
        msgEl.className = 'sgc-message sgc-assistant';
        msgEl.appendChild(wrap);
        msgsEl.appendChild(msgEl);
        if (chatbot) chatbot._scrollBottom();
      }
      cb();
    },

    /* Fetch admin boundary GeoJSON for a location, set as AOI, offer download */
    _downloadBoundaryGeoJSON: function (action, cb) {
      var query    = action.query || '';
      var chatbot  = ActionExecutor.chatbot;
      var geocodeUrl = ChatbotAPI.baseUrl() + '/utils/geocode?q=' + encodeURIComponent(query);

      fetch(geocodeUrl)
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.lat) { if (chatbot) chatbot._addMessage('assistant', 'Lokasi "' + query + '" tidak ditemukan.'); cb(); return; }
          var ai   = d.address_info || {};
          var isID = ai.country_code === 'id';

          if (isID && ai.province && typeof window.setAOIByAdminName === 'function') {
            // Use admin dropdown to set AOI, then wait for geometry to load
            window.setAOIByAdminName(ai.province, ai.city || '', ai.district || '', '').then(function () {
              /* AOI is now set via admin boundary — offer download of current AOI */
              if (chatbot) _offerCurrentAOIDownload(chatbot, query);
              cb();
            });
          } else if (d.bbox) {
            /* Non-Indonesia: use bbox GeoJSON fallback */
            var b = d.bbox;
            var feature = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[
              [b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]],[b[0],b[1]]
            ]]}, properties: { name: d.display_name || query } };
            if (typeof window.setAOIFromGeoJSON === 'function') window.setAOIFromGeoJSON(feature, d.display_name || query);
            if (chatbot) _offerCurrentAOIDownload(chatbot, query, feature);
            cb();
          } else {
            if (chatbot) chatbot._addMessage('assistant', 'Tidak dapat mengambil batas wilayah untuk "' + query + '".');
            cb();
          }
        })
        .catch(function () { cb(); });

      function _offerCurrentAOIDownload(chatbot, name, forceFeature) {
        setTimeout(function () {
          var feature = forceFeature;
          if (!feature && typeof window.setAOIFromGeoJSON !== 'undefined') {
            var aoi = typeof currentAOI !== 'undefined' ? currentAOI : null;
            if (aoi && aoi.geojson) feature = aoi.geojson.features ? aoi.geojson.features[0] : aoi.geojson;
          }
          if (!feature) { chatbot._addMessage('assistant', 'Batas wilayah ' + escapeHtml(name) + ' sudah diset di peta.'); return; }
          var geoText  = JSON.stringify({ type: 'FeatureCollection', features: [feature] }, null, 2);
          var blob     = new Blob([geoText], { type: 'application/json' });
          var url      = URL.createObjectURL(blob);
          var safeName = name.replace(/[^a-zA-Z0-9_\- ]/g, '_').slice(0, 60);
          var dlMsg    = document.createElement('div');
          dlMsg.className = 'sgc-message sgc-assistant';
          dlMsg.innerHTML =
            '<div class="sgc-bubble">Batas wilayah <strong>' + escapeHtml(name) + '</strong> sudah diset sebagai AOI.' +
            ' <a href="' + url + '" download="' + escapeHtml(safeName) + '.geojson" style="color:#1e6b3c;font-weight:600;">' +
            '<i class="fas fa-download me-1"></i>Unduh GeoJSON</a></div>';
          var msgs = document.getElementById('sgc-messages');
          if (msgs) msgs.appendChild(dlMsg);
          chatbot._scrollBottom();
        }, 500);
      }
    },
  };

  /* ─── Utilities ──────────────────────────────────────────────── */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function renderMarkdown(text) {
    if (!text) return '';
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,'<em>$1</em>')
      .replace(/`(.+?)`/g,'<code>$1</code>')
      .replace(/\n/g,'<br>');
  }
  function actionLabel(action) {
    var labels = {
      switch_module:     function(a){ return 'Pindah ke modul <strong>'+escapeHtml(a.module||'')+'</strong>'; },
      set_value:         function(a){ return 'Atur <strong>'+escapeHtml(a.target||'')+'</strong> → '+escapeHtml(String(a.value!=null?a.value:'')); },
      run_analysis:      function(a){ return 'Jalankan analisis <strong>'+escapeHtml(a.analysis||'')+'</strong>'; },
      show_result_layer: function(a){ return 'Tampilkan layer <strong>'+escapeHtml(a.layer||'')+'</strong>'; },
      download_report:   function(a){ return 'Unduh <strong>'+escapeHtml(a.report||'')+'</strong>'; },
      fly_to:            function(a){ return '🗺️ Pindah peta ke <strong>'+escapeHtml(a.query||a.label||'lokasi')+'</strong>'; },
      set_aoi_geocode:   function(a){ return '📍 Set AOI → <strong>'+escapeHtml(a.query||'')+'</strong>'; },
      guide_step:        function(a){ return '📋 Langkah '+escapeHtml(String(a.step||1))+'/'+escapeHtml(String(a.total||1))+': '+escapeHtml(a.title||''); },
      highlight_ui:      function(a){ return '👆 Sorot elemen <strong>'+escapeHtml(a.element_id||'')+'</strong>'; },
      request_file_aoi:  function(a){ return '📎 Minta upload file AOI'; },
      open_draw_tool:    function(a){ return '✏️ Buka alat gambar AOI'; },
      ask_user:          function(a){ return '<em>'+escapeHtml(a.question||'')+'</em>'; },
      explain:           function(a){ return 'Jelaskan: '+escapeHtml(a.topic||''); },
      offer_choices:              function(a){ return '🔘 '+escapeHtml(a.question||'Pilih opsi'); },
      download_boundary_geojson:  function(a){ return '⬇️ Ambil batas wilayah GeoJSON: <strong>'+escapeHtml(a.query||'')+'</strong>'; },
    };
    var fn = labels[action.type];
    return fn ? fn(action) : escapeHtml(action.type);
  }

  /* ─── Chatbot class ──────────────────────────────────────────── */
  function SaveGeoChatbot() {
    this.isOpen        = false;
    this.isLoading     = false;
    this._pendingImage = null; // base64 PNG (screenshot or image file)
    this._pendingFile  = null; // {name, mime_type, text?, b64?, icon, size_label}
    this._maxFileMb    = 5;    // updated from /api/admin/config/public at init
    this._sessionId    = null; // current session ID (null = not yet created)
    this._sessions     = [];   // cached session list
    this._sessionPanelOpen = false;
  }

  SaveGeoChatbot.prototype.init = function () {
    this._buildDOM();
    this._bindEvents();
    this._addMessage('assistant', chatText('welcome'));
    this._renderQuickActions();
    this._fetchLimits();
    this._fetchSessions();
  };

  /* ── Session management ──────────────────────────────────────────── */

  SaveGeoChatbot.prototype._fetchSessions = function () {
    var self    = this;
    var baseUrl = ChatbotAPI.baseUrl();
    fetch(baseUrl + '/chat/sessions')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.sessions) {
          self._sessions = data.sessions;
          if (self._sessionPanelOpen) self._renderSessionPanel();
        }
      })
      .catch(function () { /* silent */ });
  };

  SaveGeoChatbot.prototype._toggleSessionPanel = function () {
    var panel = document.getElementById('sgc-session-panel');
    if (!panel) return;
    this._sessionPanelOpen = !this._sessionPanelOpen;
    if (this._sessionPanelOpen) {
      panel.style.display = 'flex';
      this._fetchSessions();
    } else {
      panel.style.display = 'none';
    }
  };

  SaveGeoChatbot.prototype._renderSessionPanel = function () {
    var self = this;
    var list = document.getElementById('sgc-session-list');
    if (!list) return;
    list.innerHTML = '';

    var q = (document.getElementById('sgc-session-search') || {}).value || '';
    var filtered = q
      ? self._sessions.filter(function (s) {
          return s.title.toLowerCase().indexOf(q.toLowerCase()) !== -1;
        })
      : self._sessions;

    if (self._sessions.length === 0) {
      list.innerHTML = '<div class="sgc-session-empty">Belum ada percakapan tersimpan.</div>';
      return;
    }
    if (filtered.length === 0) {
      list.innerHTML = '<div class="sgc-session-empty">Tidak ada percakapan yang cocok.</div>';
      return;
    }

    filtered.forEach(function (s) {
      var item = document.createElement('div');
      item.className = 'sgc-session-item' + (s.id === self._sessionId ? ' active' : '');
      var rel  = _relTime(new Date(s.updated_at));
      item.innerHTML =
        '<div class="sgc-session-info">' +
          '<div class="sgc-session-title">' + escapeHtml(s.title) + '</div>' +
          '<div class="sgc-session-meta">' + rel + ' &bull; ' + s.message_count + ' pesan</div>' +
        '</div>' +
        '<button class="sgc-session-rename" title="Ganti nama"><i class="fas fa-pencil-alt"></i></button>' +
        '<button class="sgc-session-del"    title="Hapus"><i class="fas fa-trash"></i></button>';

      item.querySelector('.sgc-session-info').addEventListener('click', function () {
        self._openSession(s.id);
      });
      item.querySelector('.sgc-session-rename').addEventListener('click', function (e) {
        e.stopPropagation();
        self._startRename(s.id, s.title, item);
      });
      item.querySelector('.sgc-session-del').addEventListener('click', function (e) {
        e.stopPropagation();
        self._deleteSession(s.id, item);
      });
      list.appendChild(item);
    });
  };

  SaveGeoChatbot.prototype._openSession = function (id) {
    var self    = this;
    var baseUrl = ChatbotAPI.baseUrl();
    fetch(baseUrl + '/chat/sessions/' + id)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        /* Clear messages and repopulate */
        var msgs = document.getElementById('sgc-messages');
        if (msgs) msgs.innerHTML = '';
        self._sessionId = id;
        (data.messages || []).forEach(function (m) {
          var role = m.role === 'user' ? 'user' : 'assistant';
          self._addMessage(role, m.content);
        });
        self._renderSessionPanel();
        self._toggleSessionPanel();  /* close panel after selecting */
        self._scrollBottom();
      })
      .catch(function () { /* silent */ });
  };

  SaveGeoChatbot.prototype._deleteSession = function (id, item) {
    var self    = this;
    var baseUrl = ChatbotAPI.baseUrl();
    fetch(baseUrl + '/chat/sessions/' + id, { method: 'DELETE' })
      .then(function (r) {
        if (r.ok) {
          self._sessions = self._sessions.filter(function (s) { return s.id !== id; });
          item.remove();
          if (self._sessionId === id) {
            self._sessionId = null;
            var msgs = document.getElementById('sgc-messages');
            if (msgs) msgs.innerHTML = '';
            self._addMessage('assistant', chatText('welcome'));
            self._renderQuickActions();
          }
          if (self._sessions.length === 0) self._renderSessionPanel();
        }
      })
      .catch(function () { /* silent */ });
  };

  SaveGeoChatbot.prototype._startRename = function (id, currentTitle, item) {
    var self     = this;
    var infoEl   = item.querySelector('.sgc-session-info');
    var titleEl  = item.querySelector('.sgc-session-title');
    if (item.classList.contains('renaming')) return;   // already in edit mode
    item.classList.add('renaming');

    var input = document.createElement('input');
    input.className = 'sgc-session-rename-input';
    input.value     = currentTitle;
    input.maxLength = 120;

    infoEl.replaceChild(input, titleEl);
    input.focus();
    input.select();

    function commit() {
      var newTitle = input.value.trim();
      if (!newTitle || newTitle === currentTitle) {
        cancel();
        return;
      }
      self._renameSession(id, newTitle, item, currentTitle);
    }
    function cancel() {
      item.classList.remove('renaming');
      infoEl.replaceChild(titleEl, input);
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter')  { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    input.addEventListener('blur', function () { commit(); });
  };

  SaveGeoChatbot.prototype._renameSession = function (id, newTitle, item, oldTitle) {
    var self    = this;
    var baseUrl = ChatbotAPI.baseUrl();
    fetch(baseUrl + '/chat/sessions/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title: newTitle }),
    })
      .then(function (r) {
        if (r.ok) {
          // Update in-memory list
          var s = self._sessions.find(function (x) { return x.id === id; });
          if (s) s.title = newTitle;
          // Re-render
          item.classList.remove('renaming');
          self._renderSessionPanel();
        } else {
          // Revert: put back old title element
          item.classList.remove('renaming');
          self._renderSessionPanel();
        }
      })
      .catch(function () {
        item.classList.remove('renaming');
        self._renderSessionPanel();
      });
  };

  SaveGeoChatbot.prototype._newChat = function () {
    this._sessionId = null;
    var msgs = document.getElementById('sgc-messages');
    if (msgs) msgs.innerHTML = '';
    this._addMessage('assistant', chatText('welcome'));
    this._renderQuickActions();
    this._clearPendingImage && this._clearPendingImage();
    this._clearPendingFile  && this._clearPendingFile();
    if (this._sessionPanelOpen) this._toggleSessionPanel();
    this._scrollBottom();
  };

  function _relTime(d) {
    var diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60)     return 'Baru saja';
    if (diff < 3600)   return Math.floor(diff / 60) + ' menit lalu';
    if (diff < 86400)  return Math.floor(diff / 3600) + ' jam lalu';
    if (diff < 604800) return Math.floor(diff / 86400) + ' hari lalu';
    return d.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
  }

  /* Fetch public config to get max_file_mb limit */
  SaveGeoChatbot.prototype._fetchLimits = function () {
    var self    = this;
    var baseUrl = ChatbotAPI.baseUrl();
    fetch(baseUrl + '/admin/config/public')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data['ai.rate_limit_max_file_mb']) {
          self._maxFileMb = parseFloat(data['ai.rate_limit_max_file_mb']) || 5;
        }
      })
      .catch(function () { /* silent — use default 5 MB */ });
  };

  SaveGeoChatbot.prototype._buildDOM = function () {
    var btn  = document.createElement('div');
    btn.id   = 'sgc-toggle-btn';
    btn.title = 'SaveGeo Assistant';
    btn.innerHTML = '<i class="fas fa-robot"></i>' +
      '<span id="sgc-badge" class="sgc-badge" style="display:none">1</span>';
    document.body.appendChild(btn);
    this.btn = btn;

    var panel = document.createElement('div');
    panel.id  = 'sgc-panel';
    panel.innerHTML =
      '<div id="sgc-header">' +
        '<div class="sgc-header-info">' +
          '<div class="sgc-avatar"><i class="fas fa-robot"></i></div>' +
          '<div>' +
            '<div class="sgc-title">SaveGeo Assistant</div>' +
            '<div id="sgc-status" class="sgc-status">Siap membantu analisis</div>' +
          '</div>' +
        '</div>' +
        '<div class="sgc-header-actions">' +
          '<button id="sgc-history"  title="Riwayat percakapan"><i class="fas fa-history"></i></button>' +
          '<button id="sgc-new-chat" title="Percakapan baru"><i class="fas fa-plus"></i></button>' +
          '<button id="sgc-close"    title="Tutup"><i class="fas fa-times"></i></button>' +
        '</div>' +
      '</div>' +
      '<div id="sgc-session-panel" style="display:none">' +
        '<div id="sgc-session-search-wrap">' +
          '<i class="fas fa-search sgc-session-search-icon"></i>' +
          '<input id="sgc-session-search" type="text" placeholder="Cari percakapan..." autocomplete="off">' +
        '</div>' +
        '<div id="sgc-session-list"></div>' +
      '</div>' +
      '<div id="sgc-messages"></div>' +
      '<div id="sgc-quick-actions"></div>' +
      '<div id="sgc-img-preview-bar" style="display:none"></div>' +
      '<div id="sgc-file-preview-bar" style="display:none"></div>' +
      '<div id="sgc-input-area">' +
        '<button id="sgc-camera" title="Screenshot peta"><i class="fas fa-camera"></i></button>' +
        '<button id="sgc-attach" title="Lampirkan file (gambar, PDF, CSV, TXT)"><i class="fas fa-paperclip"></i></button>' +
        '<input type="file" id="sgc-file-input" accept="image/*,.pdf,.txt,.csv,.json,.geojson,.kml,.md,.docx,.zip,.shp" style="display:none">' +
        '<textarea id="sgc-input" placeholder="Tanyakan sesuatu atau minta analisis..." rows="1"></textarea>' +
        '<button id="sgc-send" title="Kirim"><i class="fas fa-paper-plane"></i></button>' +
      '</div>';
    document.body.appendChild(panel);

    this.panel          = panel;
    this.messagesEl     = document.getElementById('sgc-messages');
    this.inputEl        = document.getElementById('sgc-input');
    this.statusEl       = document.getElementById('sgc-status');
    this.quickActionsEl = document.getElementById('sgc-quick-actions');
    this.imgPreviewBar  = document.getElementById('sgc-img-preview-bar');
    this.filePreviewBar = document.getElementById('sgc-file-preview-bar');
  };

  SaveGeoChatbot.prototype._bindEvents = function () {
    var self = this;
    this.btn.addEventListener('click',                    function ()  { self.toggle(); });
    document.getElementById('sgc-close').addEventListener('click',    function ()  { self.close(); });
    document.getElementById('sgc-history').addEventListener('click',  function ()  { self._toggleSessionPanel(); });
    document.getElementById('sgc-new-chat').addEventListener('click', function ()  { self._newChat(); });
    document.getElementById('sgc-session-search').addEventListener('input', function () { self._renderSessionPanel(); });
    document.getElementById('sgc-send').addEventListener('click',     function ()  { self._handleSend(); });
    document.getElementById('sgc-camera').addEventListener('click',   function ()  { self._handleCamera(); });
    document.getElementById('sgc-attach').addEventListener('click',   function ()  { document.getElementById('sgc-file-input').click(); });
    document.getElementById('sgc-file-input').addEventListener('change', function (e) { self._handleFileSelect(e); });
    this.inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); self._handleSend(); }
    });
    this.inputEl.addEventListener('input', function () {
      self.inputEl.style.height = 'auto';
      self.inputEl.style.height = Math.min(self.inputEl.scrollHeight, 120) + 'px';
    });
  };

  /* Capture map screenshot and show preview bar */
  SaveGeoChatbot.prototype._handleCamera = function () {
    var self   = this;
    var camBtn = document.getElementById('sgc-camera');
    camBtn.disabled = true;
    camBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    self._setStatus('Mengambil screenshot peta...');

    captureMapScreenshot()
      .then(function (b64) {
        self._pendingImage = b64;
        self._showImgPreview(b64);
        self.inputEl.placeholder = 'Tambahkan pertanyaan tentang screenshot ini...';
        self.inputEl.focus();
        self._setStatus('Screenshot siap — kirim pesan atau tekan Kirim');
      })
      .catch(function (err) {
        self._addMessage('assistant', 'Gagal mengambil screenshot: ' + escapeHtml(err.message));
        self._setStatus('Siap membantu analisis');
      })
      .finally(function () {
        camBtn.disabled = false;
        camBtn.innerHTML = '<i class="fas fa-camera"></i>';
      });
  };

  SaveGeoChatbot.prototype._showImgPreview = function (b64) {
    var self = this;
    var bar  = this.imgPreviewBar;
    bar.innerHTML =
      '<div class="sgc-img-preview-inner">' +
        '<img src="data:image/png;base64,' + b64 + '" class="sgc-img-thumb" alt="screenshot peta">' +
        '<div class="sgc-img-preview-label"><i class="fas fa-map me-1"></i>Screenshot peta siap dikirim</div>' +
        '<button class="sgc-img-clear" title="Hapus screenshot"><i class="fas fa-times"></i></button>' +
      '</div>';
    bar.style.display = 'block';
    bar.querySelector('.sgc-img-clear').addEventListener('click', function () {
      self._clearPendingImage();
    });
  };

  SaveGeoChatbot.prototype._clearPendingImage = function () {
    this._pendingImage = null;
    this.imgPreviewBar.style.display = 'none';
    this.imgPreviewBar.innerHTML = '';
    if (!this._pendingFile) this.inputEl.placeholder = 'Tanyakan sesuatu atau minta analisis...';
  };

  /* ─── File attachment ─────────────────────────────────────────── */
  var FILE_ICONS = {
    'application/pdf':  'fas fa-file-pdf',
    'text/csv':         'fas fa-file-csv',
    'application/json': 'fas fa-file-code',
    'text/plain':       'fas fa-file-alt',
    'text/markdown':    'fas fa-file-alt',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'fas fa-file-word',
    'application/zip':             'fas fa-file-archive',
    'application/x-zip-compressed':'fas fa-file-archive',
    'application/vnd.google-earth.kml+xml': 'fas fa-globe',
    'application/vnd.google-earth.kmz':     'fas fa-globe',
  };
  var TEXT_TYPES = ['text/plain', 'text/csv', 'application/json', 'text/markdown', 'text/md'];

  SaveGeoChatbot.prototype._handleFileSelect = function (e) {
    var self = this;
    var file = e.target.files && e.target.files[0];
    e.target.value = ''; // reset so same file can be re-selected
    if (!file) return;

    var maxBytes = self._maxFileMb * 1024 * 1024;
    if (file.size > maxBytes) {
      self._addMessage('assistant',
        'File terlalu besar (' + (file.size / 1048576).toFixed(1) + ' MB). ' +
        'Maks ' + self._maxFileMb + ' MB.');
      return;
    }

    var mime     = file.type || 'application/octet-stream';
    var isImage  = mime.startsWith('image/');
    var isText   = TEXT_TYPES.indexOf(mime) !== -1;
    var fname    = file.name.toLowerCase();
    var sizeLabel = file.size < 1024 ? file.size + ' B'
                  : file.size < 1048576 ? (file.size / 1024).toFixed(1) + ' KB'
                  : (file.size / 1048576).toFixed(1) + ' MB';

    if (isImage) {
      var reader = new FileReader();
      reader.onload = function (ev) {
        var b64 = (ev.target.result || '').replace(/^data:[^;]+;base64,/, '');
        self._pendingImage = b64;
        self._showImgPreview(b64);
        self.inputEl.placeholder = 'Tambahkan pertanyaan tentang gambar ini...';
        self._setStatus('Gambar siap dikirim');
      };
      reader.readAsDataURL(file);
      return;
    }

    var icon = FILE_ICONS[mime] || 'fas fa-file';

    // SHP zip bundle → send to backend for conversion
    var isZipSHP = fname.endsWith('.zip') || fname.endsWith('.shp');
    if (isZipSHP) {
      self._setStatus('Mengkonversi shapefile...');
      self._addMessage('assistant', 'Memproses shapefile, harap tunggu...');
      var reader = new FileReader();
      reader.onload = function (ev) {
        var b64 = (ev.target.result || '').replace(/^data:[^;]+;base64,/, '');
        var url = ChatbotAPI.baseUrl() + '/utils/convert_shp';
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zip_b64: b64, name: file.name }),
        })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.error) {
            self._addMessage('assistant', 'Gagal konversi SHP: ' + d.error);
            self._setStatus('Siap membantu analisis');
            return;
          }
          var rawText = JSON.stringify(d.geojson);
          self._addMessage('assistant', 'Shapefile berhasil dikonversi (' + d.feature_count + ' feature).');
          self._offerGeoJSONAsAOI(d.geojson, d.name || file.name, rawText, sizeLabel);
          self._setStatus('Siap membantu analisis');
        })
        .catch(function (err) {
          self._addMessage('assistant', 'Gagal mengirim shapefile: ' + err.message);
          self._setStatus('Siap membantu analisis');
        });
      };
      reader.readAsDataURL(file);
      return;
    }

    // KML → parse client-side → GeoJSON
    var isKML = fname.endsWith('.kml');
    if (isKML) {
      var reader = new FileReader();
      reader.onload = function (ev) {
        var text = ev.target.result || '';
        var geo = _parseKMLToGeoJSON(text, file.name);
        if (geo) {
          var rawText = JSON.stringify(geo);
          self._offerGeoJSONAsAOI(geo, file.name.replace(/\.kml$/i, ''), rawText, sizeLabel);
        } else {
          self._addMessage('assistant', 'KML tidak dapat diparsing sebagai polygon AOI. Coba konversi ke GeoJSON terlebih dahulu.');
        }
      };
      reader.readAsText(file, 'UTF-8');
      return;
    }

    var isGeoJSON = fname.endsWith('.geojson') ||
                    (fname.endsWith('.json') && (mime === 'application/json' || mime === 'application/geo+json'));

    if (isText || isGeoJSON) {
      var reader = new FileReader();
      reader.onload = function (ev) {
        var text = ev.target.result || '';

        if (isGeoJSON) {
          try {
            var geo = JSON.parse(text);
            var gtype = geo.type || '';
            var isValidAOI = (gtype === 'Feature' && geo.geometry &&
                              (geo.geometry.type === 'Polygon' || geo.geometry.type === 'MultiPolygon')) ||
                             gtype === 'Polygon' || gtype === 'MultiPolygon' ||
                             (gtype === 'FeatureCollection' && (geo.features || []).length > 0);
            if (isValidAOI) {
              self._offerGeoJSONAsAOI(geo, file.name, text, sizeLabel);
              return;
            }
          } catch (err) { /* not valid GeoJSON, fall through */ }
        }

        self._pendingFile = {
          name: file.name, mime_type: mime, size_label: sizeLabel,
          icon: icon, text: text,
        };
        self._showFilePreview();
        self.inputEl.placeholder = 'Tambahkan pertanyaan tentang file ini...';
        self._setStatus('File teks siap dikirim');
      };
      reader.readAsText(file, 'UTF-8');
      return;
    }

    // Binary (PDF, DOCX, etc.) → base64
    var reader = new FileReader();
    reader.onload = function (ev) {
      var b64 = (ev.target.result || '').replace(/^data:[^;]+;base64,/, '');
      self._pendingFile = {
        name: file.name, mime_type: mime, size_label: sizeLabel,
        icon: icon, b64: b64,
      };
      self._showFilePreview();
      self.inputEl.placeholder = 'Tambahkan pertanyaan tentang file ini...';
      self._setStatus('File siap dikirim');
    };
    reader.readAsDataURL(file);
  };

  /* Minimal KML Polygon/Placemark → GeoJSON FeatureCollection */
  function _parseKMLToGeoJSON(kmlText, fileName) {
    try {
      var parser = new DOMParser();
      var doc    = parser.parseFromString(kmlText, 'text/xml');
      var features = [];

      function coordsToRing(text) {
        return text.trim().split(/\s+/).map(function (t) {
          var p = t.split(',');
          return [parseFloat(p[0]), parseFloat(p[1])];
        }).filter(function (p) { return !isNaN(p[0]) && !isNaN(p[1]); });
      }

      var placemarks = doc.getElementsByTagNameNS('*', 'Placemark');
      Array.from(placemarks).forEach(function (pm) {
        var nameEl = pm.getElementsByTagNameNS('*', 'name')[0];
        var name   = nameEl ? nameEl.textContent.trim() : '';

        // Polygon
        var polys = pm.getElementsByTagNameNS('*', 'Polygon');
        Array.from(polys).forEach(function (poly) {
          var outer = poly.getElementsByTagNameNS('*', 'outerBoundaryIs')[0];
          if (!outer) return;
          var coords = outer.getElementsByTagNameNS('*', 'coordinates')[0];
          if (!coords) return;
          var ring = coordsToRing(coords.textContent);
          if (ring.length < 3) return;
          if (ring[0][0] !== ring[ring.length-1][0] || ring[0][1] !== ring[ring.length-1][1]) ring.push(ring[0]);
          features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { name: name } });
        });

        // MultiGeometry → just collect polygons
        var mgs = pm.getElementsByTagNameNS('*', 'MultiGeometry');
        Array.from(mgs).forEach(function (mg) {
          var polys2 = mg.getElementsByTagNameNS('*', 'Polygon');
          var rings  = [];
          Array.from(polys2).forEach(function (poly) {
            var outer = poly.getElementsByTagNameNS('*', 'outerBoundaryIs')[0];
            if (!outer) return;
            var coords = outer.getElementsByTagNameNS('*', 'coordinates')[0];
            if (!coords) return;
            var ring = coordsToRing(coords.textContent);
            if (ring.length < 3) return;
            if (ring[0][0] !== ring[ring.length-1][0] || ring[0][1] !== ring[ring.length-1][1]) ring.push(ring[0]);
            rings.push(ring);
          });
          if (rings.length === 1) {
            features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [rings[0]] }, properties: { name: name } });
          } else if (rings.length > 1) {
            features.push({ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: rings.map(function(r){return [r];}) }, properties: { name: name } });
          }
        });
      });

      if (!features.length) return null;
      return { type: 'FeatureCollection', features: features };
    } catch (e) {
      return null;
    }
  }

  SaveGeoChatbot.prototype._offerGeoJSONAsAOI = function (geo, fileName, rawText, sizeLabel) {
    var self = this;
    var name = (geo.features && geo.features[0] && geo.features[0].properties && geo.features[0].properties.name)
               || (geo.properties && geo.properties.name)
               || fileName.replace(/\.geojson?$/, '');

    var card = document.createElement('div');
    card.className = 'sgc-aoi-offer';
    card.innerHTML =
      '<div class="sgc-aoi-offer-icon"><i class="fas fa-map-marked-alt"></i></div>' +
      '<div class="sgc-aoi-offer-body">' +
        '<div class="sgc-aoi-offer-title">GeoJSON AOI terdeteksi</div>' +
        '<div class="sgc-aoi-offer-name">' + escapeHtml(fileName) + ' &bull; ' + sizeLabel + '</div>' +
      '</div>' +
      '<div class="sgc-aoi-offer-actions">' +
        '<button class="sgc-aoi-btn-set">📍 Jadikan AOI</button>' +
        '<button class="sgc-aoi-btn-send">💬 Kirim ke AI</button>' +
      '</div>';

    card.querySelector('.sgc-aoi-btn-set').addEventListener('click', function () {
      // Set AOI directly via window function
      var feature = geo;
      if (geo.type === 'FeatureCollection') {
        feature = geo.features[0];
      } else if (geo.type === 'Polygon' || geo.type === 'MultiPolygon') {
        feature = { type: 'Feature', geometry: geo, properties: { name: name } };
      }
      if (typeof window.setAOIFromGeoJSON === 'function') {
        window.setAOIFromGeoJSON(feature, name);
        self._addMessage('assistant', '✅ AOI **' + name + '** berhasil diset dari file GeoJSON. Wilayah ditampilkan di peta.');
      } else if (typeof window.loadGeoJSONAsAOI === 'function') {
        window.loadGeoJSONAsAOI(feature);
        self._addMessage('assistant', '✅ AOI dari file **' + fileName + '** telah diset.');
      } else {
        self._addMessage('assistant', '⚠️ Fungsi set AOI belum tersedia. Pastikan index.html menyediakan `window.setAOIFromGeoJSON`.');
      }
      card.remove();
    });

    card.querySelector('.sgc-aoi-btn-send').addEventListener('click', function () {
      self._pendingFile = {
        name: fileName, mime_type: 'application/json', size_label: sizeLabel,
        icon: 'fas fa-map', text: rawText,
      };
      self._showFilePreview();
      self.inputEl.placeholder = 'Tanyakan sesuatu tentang GeoJSON ini...';
      card.remove();
    });

    var msgs = document.getElementById('sgc-messages');
    if (msgs) { msgs.appendChild(card); msgs.scrollTop = msgs.scrollHeight; }
  };

  SaveGeoChatbot.prototype._showFilePreview = function () {
    var self = this;
    var f    = this._pendingFile;
    if (!f) return;
    var bar = this.filePreviewBar;
    bar.innerHTML =
      '<div class="sgc-file-preview-inner">' +
        '<i class="' + f.icon + ' sgc-file-icon"></i>' +
        '<div class="sgc-file-meta">' +
          '<span class="sgc-file-name">' + escapeHtml(f.name) + '</span>' +
          '<span class="sgc-file-size">' + f.size_label + '</span>' +
        '</div>' +
        '<button class="sgc-img-clear" title="Hapus lampiran"><i class="fas fa-times"></i></button>' +
      '</div>';
    bar.style.display = 'block';
    bar.querySelector('.sgc-img-clear').addEventListener('click', function () {
      self._clearPendingFile();
    });
  };

  SaveGeoChatbot.prototype._clearPendingFile = function () {
    this._pendingFile = null;
    this.filePreviewBar.style.display = 'none';
    this.filePreviewBar.innerHTML = '';
    if (!this._pendingImage) this.inputEl.placeholder = 'Tanyakan sesuatu atau minta analisis...';
  };

  SaveGeoChatbot.prototype.toggle = function () { this.isOpen ? this.close() : this.open(); };
  SaveGeoChatbot.prototype.open   = function () {
    this.isOpen = true;
    this.panel.classList.add('sgc-open');
    document.getElementById('sgc-badge').style.display = 'none';
    var self = this;
    setTimeout(function () { self.inputEl.focus(); }, 280);
  };
  SaveGeoChatbot.prototype.close  = function () {
    this.isOpen = false;
    this.panel.classList.remove('sgc-open');
  };

  SaveGeoChatbot.prototype._setStatus = function (text) {
    if (this.statusEl) this.statusEl.textContent = text;
    if (this._loadingPhaseEl) this._loadingPhaseEl.textContent = text;
  };

  SaveGeoChatbot.prototype._handleSend = function (prefill) {
    var text  = prefill || this.inputEl.value.trim();
    /* Quick-action prefill never attaches pending screenshot/file */
    var image = prefill ? null : this._pendingImage;
    var file  = prefill ? null : this._pendingFile;

    if (!text && !image && !file) return;
    if (this.isLoading) return;
    if (!prefill) { this.inputEl.value = ''; this.inputEl.style.height = 'auto'; }

    var defaultCaption = image ? 'Tolong analisis screenshot peta ini.'
                       : file  ? 'Tolong analisis file ini.'
                       : '';
    var displayText = text || defaultCaption;
    if (!text) text = displayText;

    this._addUserMessage(displayText, image, file);
    this._clearQuickActions();
    if (image) this._clearPendingImage();
    if (file)  this._clearPendingFile();
    this._callBackend(text, image, file);
  };

  /* User message bubble — optionally with screenshot thumbnail and/or file badge */
  SaveGeoChatbot.prototype._addUserMessage = function (text, imageB64, fileObj) {
    var el = document.createElement('div');
    el.className = 'sgc-message sgc-user';
    var bubble = document.createElement('div');
    bubble.className = 'sgc-bubble';
    var html = '';
    if (imageB64) {
      html += '<img src="data:image/png;base64,' + imageB64 +
              '" class="sgc-img-bubble" alt="screenshot/gambar"><br>';
    }
    if (fileObj) {
      html += '<span class="sgc-file-badge"><i class="' + fileObj.icon + '"></i> ' +
              escapeHtml(fileObj.name) + ' (' + fileObj.size_label + ')</span><br>';
    }
    html += renderMarkdown(text);
    bubble.innerHTML = html;
    el.appendChild(bubble);
    this.messagesEl.appendChild(el);
    this._scrollBottom();
  };

  SaveGeoChatbot.prototype._callBackend = function (message, imageB64, fileObj) {
    var self = this;

    // Cancel any previous in-flight request
    if (self._abortController) { try { self._abortController.abort(); } catch (e) {} }
    self._abortController = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var signal = self._abortController ? self._abortController.signal : null;

    self.isLoading = true;
    self._setStatus('Menghubungi AI...');
    var loadingId = self._addLoadingDots();

    /* Elapsed timer */
    var elapsed   = 0;
    var elapsedEl = document.querySelector('#' + loadingId + ' .sgc-loading-elapsed');
    var phaseEl   = document.querySelector('#' + loadingId + ' .sgc-loading-phase');
    self._loadingPhaseEl = phaseEl;

    var timer = setInterval(function () {
      elapsed++;
      if (elapsedEl) elapsedEl.textContent = elapsed + ' detik';
      // After 30s show slow-warning + retry button inline
      if (elapsed === 30) {
        var footer = document.querySelector('#' + loadingId + ' .sgc-loading-footer');
        if (footer && !footer.querySelector('.sgc-loading-retry')) {
          var retryBtn = document.createElement('button');
          retryBtn.className = 'sgc-loading-retry';
          retryBtn.textContent = 'Coba Lagi';
          retryBtn.addEventListener('click', function () {
            clearInterval(timer);
            if (self._abortController) self._abortController.abort();
            self._removeEl(loadingId);
            self.isLoading = false;
            self._loadingPhaseEl = null;
            self._callBackend(message, imageB64, fileObj);
          });
          footer.appendChild(retryBtn);
          if (phaseEl) phaseEl.textContent = 'Respons lambat — server sibuk?';
        }
      }
    }, 1000);

    ChatbotAPI.send(message, imageB64 || null, fileObj || null, self._sessionId, signal)
      .then(function (response) {
        clearInterval(timer);
        self._removeEl(loadingId);
        self._loadingPhaseEl = null;
        /* Save session ID from response for subsequent messages */
        if (response.session_id) {
          var isNew = !self._sessionId;
          self._sessionId = response.session_id;
          if (isNew) self._fetchSessions();  // refresh list on first message
        }
        /* Rate-limit response — show warning bubble, no retry chip */
        if (response.intent === 'rate_limited') {
          self._addMessage('assistant', '⚠️ ' + (response.message || 'Rate limit tercapai.'));
          return;
        }
        self._handleResponse(response);
      })
      .catch(function (err) {
        clearInterval(timer);
        self._removeEl(loadingId);
        self._loadingPhaseEl = null;
        if (err && err.name === 'AbortError') {
          // User cancelled — show quiet chip to re-send
          self._addRetryChip(message, imageB64 || null, fileObj || null, 'Permintaan dibatalkan.');
        } else {
          self._addMessage('assistant',
            'Maaf, terjadi kesalahan: ' + escapeHtml(err.message) + '. Coba lagi.');
          self._addRetryChip(message, imageB64 || null, fileObj || null);
        }
      })
      .finally(function () {
        clearInterval(timer);
        self.isLoading = false;
        self._loadingPhaseEl = null;
        self._setStatus('Siap membantu analisis');
        if (!self.isOpen) document.getElementById('sgc-badge').style.display = 'flex';
      });
  };

  /* ── Response handler for { intent, confidence, needs_confirmation, message, warnings, actions } */
  SaveGeoChatbot.prototype._handleResponse = function (resp) {
    /* Fallback for old /agent/analyze schema */
    if (resp.plan && !resp.actions) { this._handleLegacyResponse(resp); return; }

    var self = this;
    var msg      = resp.message || '';
    var warnings = resp.warnings || [];
    var actions  = resp.actions  || [];

    if (msg) this._addMessage('assistant', msg);
    if (warnings.length) this._addWarningBlock(warnings);

    /* ask_user action → show question as assistant bubble */
    actions.filter(function (a) { return a.type === 'ask_user'; }).forEach(function (a) {
      self._addMessage('assistant', a.question || '');
    });

    /* executable actions (filter out conversational ones) */
    var execActions = actions.filter(function (a) {
      return a.type !== 'ask_user' && a.type !== 'explain';
    });

    if (execActions.length === 0) {
      this._renderQuickActions();
      this._scrollBottom();
      return;
    }

    if (resp.needs_confirmation) {
      this._showConfirmCard(execActions);
    } else {
      this._runActions(execActions);
    }

    this._scrollBottom();
  };

  /* Confirmation card with action list + Jalankan / Batalkan */
  SaveGeoChatbot.prototype._showConfirmCard = function (actions) {
    var self = this;
    var card = document.createElement('div');
    card.className = 'sgc-plan-card';

    var listHtml = '<ol class="sgc-plan-steps">' +
      actions.map(function (a) { return '<li>' + actionLabel(a) + '</li>'; }).join('') +
      '</ol>';

    card.innerHTML =
      '<div class="sgc-plan-header">' +
        '<span class="sgc-plan-badge">Menunggu Konfirmasi</span>' +
      '</div>' +
      listHtml +
      '<div class="sgc-plan-footer" id="sgc-confirm-footer"></div>';

    var footer = card.querySelector('#sgc-confirm-footer');

    var runBtn = document.createElement('button');
    runBtn.className = 'sgc-exec-btn';
    runBtn.innerHTML = '<i class="fas fa-play-circle"></i> Jalankan';
    runBtn.addEventListener('click', function () {
      runBtn.disabled  = true;
      cancelBtn.disabled = true;
      footer.innerHTML = '<div class="sgc-status-running"><i class="fas fa-spinner fa-spin me-1"></i> Menjalankan tindakan...</div>';
      self._runActions(actions, card);
    });

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'sgc-cancel-btn';
    cancelBtn.textContent = 'Batalkan';
    cancelBtn.addEventListener('click', function () {
      card.remove();
      self._addMessage('assistant', 'Tindakan dibatalkan.');
      self._renderQuickActions();
    });

    footer.appendChild(runBtn);
    footer.appendChild(cancelBtn);
    this.messagesEl.appendChild(card);
    this._scrollBottom();
  };

  /* Execute actions and update the card as each step completes */
  SaveGeoChatbot.prototype._runActions = function (actions, card) {
    var self = this;
    ActionExecutor.chatbot = self;   // expose chatbot ref to executor actions
    var hadAnalysis = (actions || []).some(function (a) { return a.type === 'run_analysis'; });
    var analysisTypes = (actions || []).filter(function (a) { return a.type === 'run_analysis'; }).map(function (a) { return a.analysis; });
    ActionExecutor.run(
      actions,
      function onStep(action, i, total) {
        self._setStatus('Menjalankan ' + (i + 1) + '/' + total + '...');
        if (card) {
          var items = card.querySelectorAll('.sgc-plan-steps li');
          if (items[i]) items[i].style.opacity = '0.5';
        }
      },
      function onDone() {
        self._setStatus('Siap membantu analisis');
        if (card) {
          var footer = card.querySelector('.sgc-plan-footer, #sgc-confirm-footer, .sgc-status-running');
          if (footer) footer.innerHTML = '<span style="color:#1e6b3c;font-size:13px;"><i class="fas fa-check-circle me-1"></i> Selesai</span>';
        }
        self._renderQuickActions();
        self._scrollBottom();
        if (hadAnalysis) {
          self._narrateResults(analysisTypes);
        } else if (!card) {
          self._addMessage('assistant', 'Tindakan berhasil dijalankan.');
        }
      }
    );
  };

  /* After analysis completes, call AI to narrate and explain the results */
  SaveGeoChatbot.prototype._narrateResults = function (analysisTypes) {
    var self = this;
    var typeLabel = (analysisTypes || []).join(', ') || 'analisis';
    var sysMsg = 'Analisis ' + typeLabel + ' telah selesai dijalankan. Tolong ringkas dan jelaskan hasil analisis yang sudah tersedia: angka estimasi utama, satuan, interpretasi kondisi area, keterbatasan dataset yang dipakai, dan rekomendasi tindak lanjut.';
    var loadEl = self._addLoadingDots();
    ChatbotAPI.send(sysMsg, null, null, self._sessionId, null)
      .then(function (resp) {
        if (loadEl && loadEl.parentNode) loadEl.remove();
        if (resp && resp.message) self._addMessage('assistant', resp.message);
        if (resp && resp.warnings && resp.warnings.length) self._addWarningBlock(resp.warnings);
        if (resp && resp.session_id && !self._sessionId) {
          self._sessionId = resp.session_id;
        }
        self._scrollBottom();
      })
      .catch(function (e) {
        if (loadEl && loadEl.parentNode) loadEl.remove();
        console.warn('SaveGeoChatbot: narrateResults failed', e);
      });
  };

  /* Legacy response handler for old /agent/analyze schema */
  SaveGeoChatbot.prototype._handleLegacyResponse = function (response) {
    var plan      = response.plan || {};
    var execution = response.execution || null;
    var guidance  = plan.user_guidance || {};
    var mainText  = guidance.plain_language || plan.message || '';
    if (mainText) this._addMessage('assistant', mainText);
    if (plan.warnings && plan.warnings.length) this._addWarningBlock(plan.warnings);
    if (execution && execution.executed && execution.report) {
      var r = execution.report;
      if (r.audience_summary) this._addMessage('assistant', r.audience_summary);
    }
    this._renderQuickActions();
    this._scrollBottom();
  };

  /* ── Shared UI helpers ─────────────────────────────────────── */
  SaveGeoChatbot.prototype._addMessage = function (role, content) {
    var el     = document.createElement('div');
    el.className = 'sgc-message sgc-' + role;
    var bubble = document.createElement('div');
    bubble.className = 'sgc-bubble';
    bubble.innerHTML = renderMarkdown(content);
    el.appendChild(bubble);
    this.messagesEl.appendChild(el);
    this._scrollBottom();
    return el;
  };

  SaveGeoChatbot.prototype._addLoadingDots = function () {
    var self = this;
    var id   = 'sgc-loading-' + Date.now();
    var el   = document.createElement('div');
    el.id    = id;
    el.className = 'sgc-message sgc-assistant';
    el.innerHTML =
      '<div class="sgc-bubble sgc-loading-bubble">' +
        '<div class="sgc-loading-dots">' +
          '<span class="sgc-dot"></span>' +
          '<span class="sgc-dot"></span>' +
          '<span class="sgc-dot"></span>' +
        '</div>' +
        '<div class="sgc-loading-phase">Menghubungi AI...</div>' +
        '<div class="sgc-loading-footer">' +
          '<span class="sgc-loading-elapsed">0 detik</span>' +
          '<button class="sgc-loading-cancel">Batalkan</button>' +
        '</div>' +
      '</div>';
    this.messagesEl.appendChild(el);

    el.querySelector('.sgc-loading-cancel').addEventListener('click', function () {
      if (self._abortController) self._abortController.abort();
    });

    this._scrollBottom();
    return id;
  };

  SaveGeoChatbot.prototype._removeEl = function (id) {
    var el = document.getElementById(id);
    if (el) el.remove();
  };

  SaveGeoChatbot.prototype._addRetryChip = function (message, imageB64, fileObj, cancelMsg) {
    var self = this;
    var row  = document.createElement('div');
    row.className = 'sgc-action-row';
    if (cancelMsg) {
      var note = document.createElement('span');
      note.style.cssText = 'font-size:12px;color:#6b7280;margin-right:6px;';
      note.textContent   = cancelMsg;
      row.appendChild(note);
    }
    var btn  = document.createElement('button');
    btn.className = 'sgc-chip sgc-chip-warn';
    btn.innerHTML = '<i class="fas fa-redo"></i> Coba Lagi';
    btn.addEventListener('click', function () { row.remove(); self._callBackend(message, imageB64, fileObj); });
    row.appendChild(btn);
    this.messagesEl.appendChild(row);
    this._scrollBottom();
  };

  SaveGeoChatbot.prototype._addWarningBlock = function (warnings) {
    var el = document.createElement('div');
    el.className = 'sgc-warnings';
    el.innerHTML = '<div class="sgc-warning-title"><i class="fas fa-exclamation-triangle"></i> Catatan Penting</div>';
    warnings.forEach(function (w) {
      var p = document.createElement('p');
      p.className = 'sgc-warning-item';
      p.textContent = typeof w === 'string' ? w : (w.message || JSON.stringify(w));
      el.appendChild(p);
    });
    this.messagesEl.appendChild(el);
  };

  SaveGeoChatbot.prototype._renderQuickActions = function () {
    var self = this;
    this.quickActionsEl.innerHTML = '';
    (chatText('quickActions') || []).forEach(function (a) {
      var chip = document.createElement('button');
      chip.className = 'sgc-chip';
      chip.textContent = a.label;
      chip.addEventListener('click', function () {
        self._clearQuickActions();
        self._handleSend(a.msg);
      });
      self.quickActionsEl.appendChild(chip);
    });
  };

  SaveGeoChatbot.prototype._clearQuickActions = function () { this.quickActionsEl.innerHTML = ''; };
  SaveGeoChatbot.prototype._scrollBottom      = function () { this.messagesEl.scrollTop = this.messagesEl.scrollHeight; };

  /* ─── CSS additions for action status ──────────────────────── */
  (function injectCss() {
    var s = document.createElement('style');
    s.textContent =
      '.sgc-status-running{font-size:13px;color:#555;padding:4px 0;}' +
      '.sgc-plan-steps li{transition:opacity .3s;}';
    document.head.appendChild(s);
  })();

  /* ─── Bootstrap ──────────────────────────────────────────────── */
  function bootstrap() {
    if (document.getElementById('sgc-panel')) return;
    var bot = new SaveGeoChatbot();
    bot.init();
    window.saveGeoChatbot = bot;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

})();
