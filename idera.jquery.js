;(function($, window, document, undefined) {
	var SERVIDORES_WMS = {},
		CARGANDO_SERVIDORES_WMS = false, //flag para la carga del listado JSON de servidores
		_IDERA = {}; //objeto global para eventos globales del plugin

	/* plugin de jquery que permite visualizar de varias maneras
	 * los servicios de la IDERA
	 *
	 * idera.jquery EN GITHUB
	 * ----------------------
	 * http://github.com/oskosk/idera.jquery
	 *
	 * IDERA
	 * ------
	 * http://www.idera.gob.ar
	 *
	 * -Este plugin sigue la propuesta de
	 *   http://jqueryboilerplate.com/
	 */
	function Idera(el, options) {

		//Defaults:
		this.defaults = {
			debug: false,
			// un script o proxy que 
			// reciba parámetro url=xxxx
			proxy: 'http://mapa.ign.gob.ar/idera.jquery/proxy/?url='
		};

		/*
		 * Funcionamiento particular de este plugin
		 * Si se pasa una string en lugar de un objeto
		 * lo interpreto como el id de un wms específico
		 */
		if (typeof options === "string") {
			options = {
				id_nodo: options
			}
		}

		//Extending options:

		this.opts = $.extend({}, this.defaults, options);

		//Privates:
		this.$el = $(el);
		this.$mapa = [];
			//Todas las capas de idera en una array
		this.todasLasCapas = [];
		this.servidores = false;
		
	}

	// Separate functionality from object creation
	Idera.prototype = {
		/**
		 * Carga todos los capabilities de cada nodo de idera.
		 * Genera un objeto en $().data('servidores') con las capabilities
		 * parseadas
		 */
		init: function() {
			var _this = this;

				/*
				 uso una array de servidores en formato JSON
				 publicada en una URL de idera.				
				 */
			_this.onServerListReady(function() {
				$.proxy(recopilarCapabilities, _this)();
			});
		
			
			function recopilarCapabilities()
			{
				var ids = [];
					_this.servidores = SERVIDORES_WMS;
				/*
				 * Si se pasó la propiedad id_nodo
				 * a las opciones de .idera()
				 * con el id de uno de los servicios wms de la idera
				 * sólo cargo ese capabilities
				 */ 
				if ( _this.opts.id_nodo && SERVIDORES_WMS[ _this.opts.id_nodo ] === undefined) {
					_this.alert( 'No existe ese identificador en IDERA');
					return;
				}

				if ( _this.opts.id_nodo ) {
					ids.push(_this.opts.id_nodo)
				} else {
					$.each(SERVIDORES_WMS, function(id_nodo) {
						ids.push(id_nodo);
					});
				}

				$(_IDERA).on('idera.afterWMSCapabilitiesParsed', function(e, capabilities) {
       			_this._rememberWMSCapabilities(capabilities);
		        _this.alert('Cargando '+ capabilities.id_nodo +'...',1000);
				});
				/*
				$( ids ).each(function(i, id_nodo) {
					_this.onReady(id_nodo, function() {}, _this);
				
				});
				*/
			}
		
		},
		onServerListReady:function(callback, context)
		{
			var _this = this;
			// Si ya se cargó la lista de servidores
			if ( ! $.isEmptyObject(SERVIDORES_WMS) ) {
				$.proxy(callback, context)();
			} else {
				//si la lista de servidores no está cargada				
				//espero el evento afterLoadServicesList
				$(_IDERA).on('idera.afterLoadServicesList', function() {
					$.proxy(callback, context)();

				});
				//Si no se está cargando actualmente la lista
				// la carrgo y disparo el evento apenas termine de cargar
				if (! CARGANDO_SERVIDORES_WMS ) {
					CARGANDO_SERVIDORES_WMS = true;
					$.getJSON('http://mapa.ign.gob.ar/idera.jquery/servicios_wms.json', function(data) {
						$.each(data, function(id, nodo) {
							SERVIDORES_WMS[ id ] = nodo;
						})
						CARGANDO_SERVIDORES_WMS = false;					
						$(_IDERA).trigger('idera.afterLoadServicesList', SERVIDORES_WMS);
					});	
				}						
			}
		},
		onReady:function(id_nodo, callback, context)
		{
			var _this = this;

			_this.onServerListReady(function() {
				magia();	
			}, _this);

			function magia() {
				if ( SERVIDORES_WMS[ id_nodo ].capabilities !== undefined ) {
					$.proxy(callback, context)();
					return;
				} else {
					_this.alert('Esperando '+ id_nodo +'...');
					_this.$el.on('idera.afterWMSCapabilitiesAdded', function(e, capabilities) {

						if ( id_nodo === capabilities.id_nodo ) {
							$.proxy(callback, context)();
							return;
						}
					});

					// Si en este momento no se está cargando el getcapabilities, lo cargo
					if ( SERVIDORES_WMS[ id_nodo ]._cargando === undefined) {
						SERVIDORES_WMS[ id_nodo ]._cargando = true;
						_this.fetchWMSCapabilities(	id_nodo );	
					} else {

					}
				}
			}			
		},

	/*
		 * va a buscar un documento XML de Capabilities
		 * en la url que recibe como parámetro
		 * Parsea eld ocumento y lo agrega como propiedad
		 * a SERVIDORES_WMS[id_nodo]
		 */
		fetchWMSCapabilities:function(id_nodo, callback, context) {
			var _this = this,
				url = SERVIDORES_WMS[id_nodo].url;
			_this.alert('Esperando '+ id_nodo +'...');
			$.ajax({
		        type: "GET",
			    url: _this.opts.proxy + encodeURIComponent(url)
			    	+ 'service%3Dwms%26request%3DgetCapabilities%26version%3D1.1.1',
			    dataType: "xml",
			    error: function() {
			    	_this.alert('Error el cargar ' + id_nodo, 20000);
			    },
			    success: function(xml) {
			    	if (_this.opts.debug) {
		        		SERVIDORES_WMS[id_nodo].capabilities_xml = xml;
		        }			    	

			    	//si el pedido fue válido
			    	if (! $(xml).find('Service').length) {
			    		if (_this.opts.debug) {
			    			_this.alert('No se encontró el elemento Service al parsear el documento de ' + k, 10000);
			    		}
			    		return false;
			    	}
		        var capabilities = _this.parseWMSCapabilities( xml, id_nodo );	
       			$(_IDERA).trigger('idera.afterWMSCapabilitiesParsed', capabilities);			        
		        if (callback) {
		        	$.proxy(callback, context)(xml, id_nodo);	
		        }
		      }

		 	});
			
		},
    /*
     * Agrega el capabilities parseado
     * a SERVIDORES_WMS;
     */
		_rememberWMSCapabilities: function(capabilities)
		{
			var _this = this;

			var id_nodo = capabilities.id_nodo;
			/*
			 * Si ya está cargado
			 * Parece redundante pero como SERVIDORES_WMS es una array local
			 * lo puede cargar cualquiera de las instancias del plugin
			 */
			if (SERVIDORES_WMS[id_nodo].capabilities === undefined) {
				SERVIDORES_WMS[id_nodo].capabilities = capabilities;				
			}

	    /*
	     * Agrega las capas WMS parseadas
	     * a _this.todasLasCapas;
	     * dispara evento por cada capa agregada
	     */

			$(SERVIDORES_WMS[id_nodo].capabilities.Layers).each(function(k, capa) {
				_this.todasLasCapas.push( capa );	
				_this.$el.trigger('idera.afterWMSLayerAdded', capa);						
			})

			_this.$el.trigger('idera.afterWMSCapabilitiesAdded', capabilities);		
		},

		/*
		 * Usa selectores de jQuery para parsear 
		 * el documento capabilities
		 * devuelve un objeto con las propiedades del capabilities
		 *.
		 */
		parseWMSCapabilities: function(xml, id_nodo)
		{
			var _this = this;
			var capabilities = {};
			capabilities.id_nodo = id_nodo;
			capabilities.Service = {};
			capabilities.Service.urlReal = SERVIDORES_WMS[id_nodo].url ;
			capabilities.Layers = [];
			//El titúlo del servicio WMS
			capabilities.Service.Title = _parseServiceTitle(xml);
			capabilities.Service.Abstract = _parseServiceAbstract(xml);
			capabilities.Service.href = _parse_href( xml );
			capabilities.Service.ContactInformation = {};
			capabilities.Service.ContactInformation.ContactElectronicMailAddress = _parseServiceContactElectronicMailAddress( xml );
			//Formatos y SRS soportados por este servicio WMS
			capabilities.Service.soporta = {};
			//Algunos de los formatos soportados
			capabilities.Service.soporta.formatos = _parseFormatosDeGetMap(xml);
			//Algunos de los SRS soportados, no todos.
			capabilities.Service.soporta.srs = _parseSoporteDeSRS( xml );
			//Algunos de los Requests WMS soportados, no todos.
			capabilities.Service.soporta.requests = _parseSoporteDeRequests( xml );			
			//Las capas de este servicio WMS
			capabilities.Layers = _parseWMSLayers( xml );

			return capabilities;


			function _parseServiceTitle( xml )
			{
				var title = '';
				title = $(xml).find('Title:first').text();
				return title;
			}

			function _parse_href( xml )
			{
				var href = '';
				href = $(xml).find('OnlineResource').attr('xlink:href');
				return href;
			}			

			function _parseServiceAbstract( xml )
			{
				var abstract = '';
				abstract = $(xml).find('Abstract:first').text();
				return abstract;
			}

			function _parseServiceContactElectronicMailAddress( xml )
			{
				var email = '';
				email = $(xml).find('ContactInformation > ContactElectronicMailAddress').text();
				return email;
			}

			function _parseSoporteDeSRS( xml )
			{
				var srs = {}
				//Algunos de los SRS soportados, no todos.				
				//Proyección web mercator. Código original
				srs['EPSG:900913'] = false;
				//Proyección web mercator. Código estándar
				srs['EPSG:3857'] = false;
				//Coordenadas geográfica.
				srs['EPSG:4326'] = false;
				//Proyección Gaus Kruger. 
				srs['EPSG:22183'] = false;

				$.each( srs, function(k, v) { 
					$( xml ).find( "Layer:first SRS:contains('"+ k +"')").each(function() {
						srs[ k ] = true;
					})
				});

				return srs;
			}
			/*
			 * Devuelve algunos de los requests soportados
			 * por el servicio WMS. Sirve para inducir
			 * si el mismo servidor soporta WFS chequeando
			 * si soporta DescribeLayer
			 */
			function _parseSoporteDeRequests( xml )
			{
				var requests = {}
				requests['GetCapabilities'] = false;
				requests['GetMap'] = false;
				requests['GetFeatureInfo'] = false;
				requests['DescribeLayer'] = false;
				requests['GetLegendGraphic'] = false;
				requests['GetStyles'] = false;				
				$.each( requests, function(k, v) { 
					$( xml ).find( "Request > "+ k ).each(function() {
						requests[ k ] = true;
					})
				});
				return requests;
			}			


			function _parseFormatosDeGetMap(xml)
			{
				var formatos = [];
				$(xml).find('Request > GetMap > Format').each(function(k,v) {
					formatos.push($(this).text());
				});
				return formatos;
			}

			/*
			 * Parsea todas las capas WMS en el XML
			 * y devuelve una array
			 */
			function _parseWMSLayers( xml )
			{
				var layers = [];
				/* Todas las capas menos la primera,
				 *  que es la información general del Servicio
				 */
				$(xml).find('Layer:gt(0)').each(function(k,v) {
					var l = _parseLayerXML(v);
					layers.push(l);
				});
				return layers;
			}
			/*
			 * Recibe un DOM Layer del XML del capabilities
			 * y devuelve un objeto javascript con algunas propiedades
			 * parseadas de la capa
			 */
			function _parseLayerXML(capa)
			{
				var l = {};

				l.Name = _parseLayerName( capa );
				l.Title = _parseLayerTitle( capa );
				l.Abstract = _parseLayerAbstract( capa );
					//capabilities.Service todavía está en el scope de está función
				l.Service = capabilities.Service;
					//Esto para tener un id único. Sirve por ejemplo en
					//magicSuggest
				l.id= l.Service.Title + l.Name				
				l.LatLonBoundingBox = _parseLayerLatLonBoundingBox( capa );
				l.BoundingBox = _parseLayerBoundingBox( capa );
				l.Styles = _parseLayerStyles( capa );
				l.Keywords = _parseLayerKeywords( capa );
				l.MetadataURL = _parseLayerMetadataURL( capa );

				return l;

				function _parseLayerName( capa )
				{
					return $(capa).find('>Name').text();
				}

				function _parseLayerTitle( capa )
				{
					return $(capa).find('>Title').text();
				}

				function _parseLayerAbstract( capa )
				{
					return $(capa).find('>Abstract').text();
				}

				function _parseLayerLatLonBoundingBox( capa )
				{
					var LatLonBoundingBox = {};
					
					LatLonBoundingBox.minx = $(capa).find('>LatLonBoundingBox').attr('minx');
					LatLonBoundingBox.miny = $(capa).find('>LatLonBoundingBox').attr('miny');
					LatLonBoundingBox.maxx = $(capa).find('>LatLonBoundingBox').attr('maxx');
					LatLonBoundingBox.maxy = $(capa).find('>LatLonBoundingBox').attr('maxy');
					return LatLonBoundingBox;
				};

				function _parseLayerBoundingBox( capa )
				{
					var BoundingBox = {};

					BoundingBox.minx = $(capa).find('>BoundingBox').attr('minx');
					BoundingBox.miny = $(capa).find('>BoundingBox').attr('miny');
					BoundingBox.maxx = $(capa).find('>BoundingBox').attr('maxx');
					BoundingBox.maxy = $(capa).find('>BoundingBox').attr('maxy');					
					return BoundingBox;
				};

				function _parseLayerStyles( capa )
				{
					var styles = [];
					$(capa).find('>Style').each(function(k, v) {
						var s = {
							Name: $(this).find('>Name').text(),
							LegendURL: $(this).find(' LegendURL > OnlineResource').attr('xlink:href')
						};
						styles.push( s );
					});
					return styles;
				};

				function _parseLayerKeywords( capa )
				{
					var Keywords = [];
					$(capa).find('>KeywordList Keyword').each(function(k, v) {
						var kw = ''
						kw = $(this).text();
						Keywords.push( kw );
					});
					return Keywords;
				};

				function _parseLayerMetadataURL( capa ) 
				{
					var url = ''
					$(capa).find('>MetadataURL OnlineResource').each(function(k, v) {
						url = $(this).attr('xlink:href');
					});
					return url;
				};		

			}

		},
		/**
		 * Muestra un div amarillo
		 * con una notificación
		 * que dura 3 segundos por default
		 * @msg: el mensaje a mostrar
		 * @timeout: el tiempo en milisegundos que dure el mensaje
		 */
		alert: function( msg, timeout )
		{
			var _this = this;
			var $boy;
			var n_notifications = _this.$el.find('.idera_notification').length;
			$boy = $('<div class="idera_notification"></div>').css({
				'min-width':'300px'
			}).text(msg).prependTo(_this.$el)
			.css({
				/*
				 * Estilos para cartel amarillito
				 */
				position:'absolute',
				'z-index': 10000 + n_notifications,
				display:'none',
				padding: '5px 10px',
				background:'#fffed0',
				border: '1px solid #d4d287',
				margin:'5px',
				'font-family':'Arial'
			}).fadeIn();

			$('<span>[ X ]</span>').css({
				'float':'right',
				'cursor':'pointer'
			}).click(function(){
				cerrar_alert();
			}).appendTo($boy);


			if (timeout === undefined) {
				timeout = 3000;
			}
			setTimeout(cerrar_alert, timeout);
			
			/*
			 * Muestro en consola los mensaje
			 * si debug==true
			 */
			if (_this.debug && window.console !== undefined) {
				console.log('idera.jquery ' + msg);

			} 
		
			function cerrar_alert()
			{
				$boy.fadeOut('fast');
				$boy.remove();
			}			
			
		}
	};

	// The actual plugin
	/**
	 * Inicializa el elemento con los datos
	 * necesarios para las llamadas sucesivas
	 * a los otros métodos de este plugin
	 */
	$.fn.idera = function(options) {
		return this.each(function() {
			var rev = $(this).data('idera');
			if ( ! rev ) {
				rev = new Idera(this, options);
				$(this).data('idera', rev);
			}
			rev.init();
		});
	};

})(jQuery);

/**
 * TABLA DE CAPAS // WIDGET
 */
(function($) {

		/**
		 * genera una tabla con todas las capas de idera
		 */
		function renderTablaDeCapasWMS(idera) {
			var _this = idera;
			var $table = $('<table class="idera_tablaDeCapasWMS"></table');
			$table.css('table-layout', 'fixed');
			$table.css('word-wrap', 'break-word');
			var $thead = $("<thead></thead>");
			var $tbody = $("<tbody></tbody>");
			$thead.append(
				'<th>Servicio</th>' +
				'<th>Título</th>' +
				'<th>Nombre</th>' +				
				'<th>Abstract</th>'+
				'<th>Keywords</th>'+
				'<th>Link a Metadatos</th>'+
				'<th>Estilos</th>'
			);

			$table.append( $thead );
			$table.append( $tbody );
			function addRow(capa)
			{
				var $row = $('<tr></tr>');

				$row.append(
					'<td>'+capa.Service.Title+'</td>' +
					'<td>'+capa.Title+'</td>' +
					'<td>'+capa.Name+'</td>' +					
					'<td>'+capa.Abstract+'</td>' +
					'<td>'+capa.Keywords.join('<br/>')+'</td>' +
					'<td>'+capa.MetadataURL+'</td>' +
					'<td>'+capa.Styles.join('<br/>')+'</td>' 
				);
				$tbody.append( $row );
			}

			_this.$el.append($table);
			$(_this.servidores[idera.opts.id_nodo].capabilities.Layers).each(function(k,capa) {
				addRow(capa);
			});
		}
	

	// The actual plugin
	$.fn.tablaDeCapasWMS  = function(options) {
		return this.each(function() {
			var rev = $(this).data().idera;
			if ( rev !== undefined) {
				rev.onReady(rev.opts.id_nodo, function() {
					renderTablaDeCapasWMS(rev);	
				}, rev)
				
			}
		});

	};

})(jQuery);

/**
 * TABLA DE SERVICIOS WMS // WIDGET
 */
(function($) {

		/**
		 * genera una tabla con una descripción de 
		 * los servicios WMS de IDERA
		 */
		function renderTablaDeServiciosWMS(idera) {
			var _this = idera;
			var $table = $('<table class="idera_tablaDeServidores"></table');
			$table.css('table-layout', 'fixed');
			$table.css('word-wrap', 'break-word');
			var $thead = $("<thead></thead>");
			var $tbody = $("<tbody></tbody>");
			$thead.append(
				'<th>Título</th>' +
				'<th>Abstract</th>'+
				'<th>Contacto</th>'+
				'<th>href</th>'
			);

			$table.append( $thead );
			$table.append( $tbody );
			function addRow(capabilities)
			{
				var $row = $('<tr></tr>');
				$row.append(
					'<td>'+capabilities.Service.Title+'</td>' +
					'<td>'+capabilities.Service.Abstract+'</td>' +
					'<td>'+capabilities.Service.ContactInformation.ContactElectronicMailAddress+'</td>' +					
					'<td>'+capabilities.Service.href+'</td>' 
				);
				$tbody.append( $row );
			}

			_this.$el.append($table);
			_this.onServerListReady(function() {
				$.each(_this.servidores, function(id_nodo, nodo) {
					_this.onReady(id_nodo, function() {
						addRow(_this.servidores[id_nodo].capabilities);
					}, _this);
				});
			}, _this);
			//_this.$el.on('idera.afterWMSCapabilitiesAdded', function(e, capabilities) {
			//	addRow(capabilities);
			//});
		}
	

	// The actual plugin
	$.fn.tablaDeServiciosWMS  = function(options) {
		return this.each(function() {
			var rev = $(this).data().idera;
			if ( rev !== undefined) {			
				renderTablaDeServiciosWMS(rev);
			}
		});

	};

})(jQuery);

/**
 * LISTVIEW DE CAPAS WMS // WIDGET
 */
(function($) {


		/**
		 * Genera un listview de jQuery Mobile
		 * con las capas WMS de IDERA
		 */
		function renderListViewDeCapas(idera) {
			var _this = idera;


			var $ul = $('<ul></ul>').attr({
				'data-role':'listview', 'data-filter':'true','data-filter-placeholder':'IDERA: Buscar capas...',
				'data-split-icon': 'gear'
			}).appendTo( _this.$el );
			$ul.listview();

			_this.$el.on('idera.afterWMSCapabilitiesAdded', function(e, capabilities) {
				$('<li data-role="list-divider">'+capabilities.Service.Title+'</li>')
					.append('<span class="ui-li-count ui-btn-up-c ui-btn-corner-all">'+capabilities.Layers.length+'</span>')
					.appendTo($ul);
				$(capabilities.Layers).each(function(k,v) {
					
					$('<li></li>').append('<h3>'+v.Title +'</h3>')
						.append('<p>'+v.Abstract+'</p>')
						.append('<p>Nombre WMS '+v.Name+'</p>')
						.append('<p><a href="#mapa">Preview</a></p>')
						.appendTo($ul);
				});				

				$ul.listview('refresh');
			});
		}
	

	// The actual plugin
	$.fn.listviewDeCapas  = function(options) {
		return this.each(function() {
			var rev = $(this).data().idera;
			if ( rev !== undefined) {			
				var rev = $(this).data().idera;
				renderListViewDeCapas(rev);
			}
		});

	};

})(jQuery);

/**
 * AUTOCOMPLETE DE CAPAS WMS // WIDGET
 */

(function($) {
		/*
		 * Genera el autocomplete de capas de IDERA
		 * basado en magicSuggest. http://nicolasbize.github.io/magicsuggest/
		 */
		function renderAutoComplete(idera) {
			var _this = idera;
			var $suggest = $('<div class="idera_autocomplete"></div>');
			_this.$el.append( $suggest );
			var asdf = $suggest.magicSuggest({
			    width: 480,
			    allowFreeEntries:false,
			    displayField: 'Title',
			    selectionPosition:'inner',
			    noSuggestionText:'No hay sugerencias',
			    emptyText:'IDERA: Buscar capas...',			    

			    data: function(){
			    	return _this.todasLasCapas;
			    },
			    selectionRenderer: function (a){return a.Name ;},
			    renderer: function(l) {
			    	var bbox = l.LatLonBoundingBox;
			    	//Uso una mini imagen de capabaseargenmap
			    	//para indicar la zona que cubre la capa
			    	var img_url;
			    	if ( bbox.minx ) {
			    		img_url = 'http://wms.ign.gob.ar/geoserver/wms?LAYERS=capabaseargenmap&STYLES=&FORMAT=image%2Fpng&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&SRS=EPSG%3A4326&BBOX='+
			    			bbox.minx + ',' + bbox.miny + ',' + bbox.maxx + ',' + bbox.maxy +
			    			'&WIDTH=72&HEIGHT=72';
			    	} else {
			    		img_url = 'http://www.idera.gob.ar/portal/sites/default/files/styles/large/public/field/image/dave.gif';
			    	}
			    	return '<div>' +
			        '<div style="float:left;"><img style="max-width:72px;padding-top:20px" src="' + img_url + '"/></div>' +
			        '<div style="padding-left: 85px;">' +
			            '<div style="padding-top: 20px;font-style:bold;font-size:120%;color:#333">' + l.Title +  '</div>' +
			            '<div style="color: #999">' + l.Name + '</div>' +
			            '<div style="color: #999">' + l.Service.Title + '</div>' +
			            '</div>' +
			        '</div><div style="clear:both;"></div>';
		    	}
		    });
				

				$(asdf).on("selectionchange", function(e, bla, capas) {
					_this.$el.trigger('idera.autocomplete.cambioSeleccion',
						$(capas).last()[0] );
					var capa =$(capas).last()[0];
				});
		}
	

	// The actual plugin
	$.fn.autocompleteDeCapas  = function(options) {
		return this.each(function() {
			var rev = $(this).data().idera;
			if ( rev !== undefined) {			
				var rev = $(this).data().idera;
				renderAutoComplete(rev);
				//rev.renderMapa();
			}
		});

	};

})(jQuery);


/**
 * texto en prosa DE CAPAS WMS // WIDGET
 */

(function($) {
		/*
		 * Genera texto en prosa con la descripción del contenido
		 * de la IDERA
		 */
		function renderProsa(idera) {
			var _this = idera;
			_this.$el.on('idera.afterWMSCapabilitiesAdded', function(e, capabilities) {

				// El Title del Capabilities
				$('<h3></h3>').text(capabilities.Service.Title).appendTo(_this.$el);
				// Lo parseado del campo ServiceInformaction
				$('<p></p').html(capabilities.Service.Abstract).appendTo(_this.$el);
				$('<ul></ul>').append(

					$('<li></li>').html(capabilities.Service.href),
					$('<li></li>').html(capabilities.Service.ContactInformation.ContactElectronicMailAddress)
					
				).appendTo( _this.$el );
				var n_capas = capabilities.Layers.length;
				$('<span>'+n_capas + ' capas en este servicio</span>').appendTo(_this.$el);

				/*
				$(capabilities.Layers).each(function(k,v) {
					_this.$el.append(
						$('<h5>'+ (k+1) + '. ' + v.Title+'</h5>'),
						$('<p>'+v.Abstract+'</p>')
					);
				});	
				*/			
			});
		}
	

	// The actual plugin
	$.fn.prosa  = function(options) {
		return this.each(function() {
			var rev = $(this).data().idera;
			if ( rev !== undefined) {			
				var rev = $(this).data().idera;
				renderProsa(rev);
			}
		});

	};

})(jQuery);

/**
 * MAPA DE CAPAS WMS // WIDGET
 */

(function($) {
		/*
		 * Genera un mapetti
		 */
		function renderMapa(idera, id_nodo, options) {
			var _this = idera,
				layerName = options,
				capa = null,
				capabilities = idera.servidores[id_nodo].capabilities;
			$(capabilities.Layers).each(function(k,v) {
				if (v.Name == layerName) {
					capa = v;
				}
			});
			if (!capa) {
				idera.alert('No existe la capa '+ layerName,10000);
				return;
			}


			var srs = 'EPSG:3857';
			if (!capa.Service.soporta.srs['EPSG:3857']) {
				idera.alert('El servidor no soporta el SRS EPSG:3857');
				if (!capa.Service.soporta.srs['EPSG:900913']) {
					idera.alert('El servidor no soporta SRS EPSG:3857 ni EPSG:900913');
					return;					
				} else {
					idera.alert('Probando SRS EPSG:900913',6000);
					/*
					algunos servidores
					 mapserver que tienen la config en un archivo
					 de nombre epsg escrito en minúscula,
					 tiran error con EPSG:900913 en mayúsucla
					*/
					srs = 'EPSG:900913';
				}	
			}
			var tieneBBox = true;
			if (! capa.LatLonBoundingBox.minx) {
				idera.alert('El servidor no informa BoundingBox');
				tieneBBox = false;
			}

			var $mapa = $('<div class="idera_mapa"></div>')
				.css('height','100%').appendTo( idera.$el);
			$mapa.argenmap();	
			
			$mapa.agregarCapaWMS(a={
				url: capa.Service.urlReal,
				capas: capa.Name,
				nombre: capa.Title,
				projection: srs,
				srs:srs
			});

			if (tieneBBox) {
				var bounds = new OpenLayers.Bounds();
				bounds.extend(
					new OpenLayers.LonLat(capa.LatLonBoundingBox.minx,capa.LatLonBoundingBox.miny)
						.transform(new OpenLayers.Projection("EPSG:4326"), new OpenLayers.Projection('EPSG:3857'))
				);
		    bounds.extend(
		    	new OpenLayers.LonLat(capa.LatLonBoundingBox.maxx,capa.LatLonBoundingBox.maxy)
		    		.transform(new OpenLayers.Projection("EPSG:4326"), new OpenLayers.Projection('EPSG:3857'))
		    );				
				var olMap = $mapa.data().argenmap.mapa;
				olMap.zoomToExtent(bounds, true);					
			}

				
		}
	

	// The actual plugin
	$.fn.mapa  = function(options) {
		return this.each(function() {
			var rev = $(this).data().idera;
			if ( rev !== undefined) {			
				rev.onReady(rev.opts.id_nodo, function() {
					renderMapa(rev, rev.opts.id_nodo, options);
				}, rev);
			}
		});

	};

})(jQuery, window, document);