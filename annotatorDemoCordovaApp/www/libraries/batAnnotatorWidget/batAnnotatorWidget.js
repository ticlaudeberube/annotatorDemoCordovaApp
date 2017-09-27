define(['jquery', 'html2canvas', 'Zwibbler', 'domtoimage', 'canvg'], function() {
	'use strict';
	(function (Zwibbler, html2canvas, domtoimage, canvg) {

		var parser = null;
		var promises = [];
		var payload = [];
		var btnClass = '.dynamicCommentor';
		var spinningBtnClass = '.fa .fa-spinner .fa-spin';
		var openEditorBtnClass = '.fa .fa-pencil';
		var hostName = '.batraining.com';
		var tmpContentClass = '.tempContent';
		var editorLocation = 'body';
		var blockClass = '.block';
		var blockTmpContentClass =  blockClass +' '+ tmpContentClass;
		var screenGrabberBtnContainer = '.progressTracking-inner';
		var screenGrabberPositionElem = '.progressTracking-icon';
		var blockInnerClass = '.block-inner';
		var editorId = 'editor';
		var editorIdSelector = '#'+editorId;
		var editorCanvasSelector = '#editorCanvas > div:first-child+div>canvas:first-child';
		var editorCanvasName = 'editorCanvas';
		var parsingCanvasId = 'parsingCanvas';
		var deviceOrientation = null;
		var device = null;
		var btnProcessing = null;
		var viewPortEasing = isMobileBrowser() ? true : false;
		var editorOpenned = false;
		var isCordova = navigator.userAgent.match(/Cordova/i);
	
		function init(defaultParser) {
			device = isMobileBrowser() ? 'mobile' : 'desktop';
			setOrientation();
	
			if (device === 'mobile') {			
				$(window).bind('orientationchange', function() {
					setOrientation();
					var btn = $(btnClass);
					if (btn.length) {
						if(deviceOrientation === 'landscape') {
							btn.show();
						}  else {
							btn.hide();
						}
					}
				});
			}
	
			// Dom-to-image renders better but works only with desktop
			// html2canvas has many flaws - need to parse DOM and transform images with canvg
			// TODO: dom to image leaks - enable automatic Automatic tab discarding n chrome://flags
			parser = defaultParser ? defaultParser : (device === 'desktop') ? 'dom-to-image' : 'html2canvas';
	
			setScreenGrabber();

			window.setTimeout( function() {
                 $.getScript('https://hypothes.is/embed.js')
                .done( function(script, textStatus) {

                    window.hypothesisConfig = function () {
                        return {
                            'openSidebar': false
                        };
                    };			
                })
                .fail(function() {
                    console.log('Failed to load hypothesis.is client');
                });   
            }, 1000);
	
			window.setTimeout( function() {
				// move Adapt header outside of wrapper for IOS
				if (isMobileBrowser()) {
					var nav = $('.navigation').clone(true);
					$('body').append(nav);
					$('.wrapper .navigation').remove();
				}
			}, 1000);	
		}
		
		function isMobileBrowser() {
			return !isNaN(window.orientation);
		}
	
		function setOrientation() {
			deviceOrientation = window.matchMedia('(orientation: landscape)').matches ? 'landscape' : 'portrait';
		}
	
		function getUrl(src) {
			return src.substring(0, src.lastIndexOf('/') + 1);
		}
	
		function getAttributeFromString(string, prop) {
			var str = 'prop="([^"]*)"';
			str = str.replace('prop', prop);
			var regexp = new RegExp(str);
			return string.match(regexp)[1];
		}
	
		function getTempContentHolder(container) {
			return $(container).hasClass(getClassNameFromSelector(blockClass)) ? 
				$(container).find(tmpContentClass) : getParentBlock(container).find(tmpContentClass);
		}
	
		function removeTempContents() {
			$(blockTmpContentClass).remove();
		}
	
		function getParentBlock(container) {
			return $(container).parents(blockClass);
		}
	
		function setTempContentContainer(container) {
			var contentHolder = getTempContentHolder(container);
			if (!contentHolder.length) {
				var block = getParentBlock(container);
				var html = '<div class="'+getClassNameFromSelector(tmpContentClass)+'"></div>';
				block.append(html);
				contentHolder = getTempContentHolder(container);
			} else {
				contentHolder.empty();
			}
			return contentHolder;
		}
	
		function stripScripts(str) {
			var div = document.createElement('div');
			div.innerHTML = str;
			var scripts = div.getElementsByTagName('script');
			var i = scripts.length;
			while (i--) {
				scripts[i].parentNode.removeChild(scripts[i]);
			}
	
			return div.innerHTML;
		}
	
		function parseIframes(iframe) {
			var content = iframe.contentDocument;
			var src = getUrl(iframe.src);
			var html = content.body.innerHTML.replace(/images/g, src + 'images');
	
			html = stripScripts(html);
	
			var tempContent = getTempContentHolder($(iframe));
	
			if (html.indexOf('iframe') > -1) {
				html = replaceInnerIframeWithContent(html);
			}
			
			content = $(html).find('#Stage');
	
			tempContent.html(content);
		}
	
		function replaceInnerIframeWithContent(html) {
			var div = document.createElement('div');
	
			var content = html.split('iframe');
			content[0] = content[0].slice(0, -1);
			content[2] = content[2].replace(/^>/, '');
	
			if (content[1].indexOf(hostName) > -1) {
				var url = getAttributeFromString(content[1], 'src');
				content[1] = getCode(url);
			} else {
				content[1] = '<div>Use a proxy to parse and get inner frames HTML and paste content here</div>';
			}
	
			div.innerHTML = content[0] + content[1] + content[2];
	
			return div.innerHTML;
		}
	
		function noScroll() {
	
			$('body').on('touchmove', function(e) { 
				e.preventDefault(); 
			});
		}
		
		function noScrollOff() {
	
			$('body').off('touchmove');
	
			var aTag = $('a[name="currentLocation"]');
			if (aTag.length ) {
				$('html,body').animate({scrollTop: aTag.offset().top},'fast', function() {
					$('a[name=currentLocation]').remove();
				});
			}
		}
	
		function initEditor(dataURI) {	
			var page = $(editorLocation);
			var html = '<div id="'+editorId+'" class="loading"></div>';
	
			page.append(html).css({ position: 'relative' });
	
			var editor = page.find(editorIdSelector);
			editor.append('<div id="'+editorCanvasName+'"></div>');
			//editor.append('<div id="editorWorking" class="hidden"><div class="message"></div></div>');
			
			editor.append('<i id="editor-remove" class="editor-btn editor-remove-btn fa fa-times"></i>');
			editorOpenned = true;

			hideSpinner();
	
			editor.find('#editor-remove').on('click', function () {
				removeTempContents();
				$(btnClass).trigger('editorClosed');
				$(this).parent().remove();
				editorOpenned = false;		
				noScrollOff();			
			});
	
			if (isMobileBrowser()) {
				editor.append('<i id="editor-link" class="editor-btn editor-link-btn fa fa-external-link"></i>');
				$('#editor-link').on('click', function () {
					openWindow();
				});
			} else if (isCordova) {
				editor.append('<i id="editor-clipboard" class="editor-btn editor-clipboard-btn fa fa-clipboard"></i>');
				$('#editor-clipboard').on('click', function () {
					trimEditorCanvas().then( function(url) {
						cordova.plugins.clipboard.copy(url, function() {
							alert('Image copied to clipboard');
						}, function() {
							alert('error');
						});
					});
				});
			} else {
				editor.append('<i id="editor-download" class="editor-btn editor-download-btn fa fa-download"></i>');
				$('#editor-download').on('click', function () {
					var filename = prompt('Please enter a filename');
					if (filename) {
						ctx.download('png', filename + '.png');
					}
				});
	
				editor.append('<i id="editor-link" class="editor-btn editor-link-btn fa fa-external-link"></i>');
				$('#editor-link').on('click', function () {
					openWindow();
				});
			}
			
			var ctx = Zwibbler.create(editorCanvasName, {
				showToolbar: true,
				multilineText: true,
				defaultLineWidth: 0,
				useTouch : true,
				defaultZoom: 0.75,
				pageView: false,
				showColourPanel: true,
				scrollbars: false,
				showDebug: false,
				backgroundImage: dataURI
			});
	
			ctx.on('document-changed', function() {
				$(editorIdSelector).removeClass('loading');

				// fixes a bug when require is used along with Hypothes. Editor tools image url is changed to https://hypothes.is/...
				editor.find('img[src$=png]').each( function(index, _el) {
					var el = $(_el);
					var src = el.attr('src');
					var fileName = src.split('/').slice(-1)[0];
					el.attr('src', 'libraries/batAnnotatorWidget/'+fileName);
				});
			});	
	
			noScroll();
		}
	
		function openWindow() {
			trimEditorCanvas().then( function(url) {
				window.open('about:blank').document.body.innerHTML = `<div>
					<ol style="font-family: Arial, Helvetica, sans-serif; font-size: 1em">
						<li>Right click on image and select: Open image (mobile only).</li>
						<li>Right click on image and select: Copy image address.</li>
						<li>Close tab.</li>
						<li>In annotation sidebar, click insert image icon.</li>
						<li>Right click or CTRL+C to paste image in between brackets:(http://insert-your-link-here.com).</li>
						<hr>
					<img src="${url}">
				<div>`;
			});
		}
	
		function trimEditorCanvas() {
			var dfd = new $.Deferred();
				var trimmed = trim($(editorCanvasSelector)[0]);			
				dfd.resolve(trimmed.toDataURL());		
			return dfd.promise();
		} 
	
		function trim(c) {
			//https://gist.github.com/remy/784508
			var ctx = c.getContext('2d'),
			  copy = document.createElement('canvas').getContext('2d'),
			  pixels = ctx.getImageData(0, 0, c.width, c.height),
			  l = pixels.data.length,
			  i,
			  bound = {
				top: null,
				left: null,
				right: null,
				bottom: null
			  },
			  x, y;
		  
			for (i = 0; i < l; i += 4) {
			  if (pixels.data[i+3] !== 0) {
				x = (i / 4) % c.width;
				y = ~~((i / 4) / c.width);
			
				if (bound.top === null) {
				  bound.top = y;
				}
				
				if (bound.left === null) {
				  bound.left = x; 
				} else if (x < bound.left) {
				  bound.left = x;
				}
				
				if (bound.right === null) {
				  bound.right = x + 1; 
				} else if (bound.right < x) {
				  bound.right = x + 1;
				}
				
				if (bound.bottom === null) {
				  bound.bottom = y + 1;
				} else if (bound.bottom < y) {
				  bound.bottom = y + 1;
				}
			  }
			}
			  
			var trimHeight = bound.bottom - bound.top,
				trimWidth = bound.right - bound.left,
				trimmed = ctx.getImageData(bound.left, bound.top, trimWidth, trimHeight);
			
			copy.canvas.width = trimWidth;
			copy.canvas.height = trimHeight;
			copy.putImageData(trimmed, 0, 0);
			
			// open new window with trimmed image:
			return copy.canvas;
		}
	
		function parseContent(selection) {
			var w = selection.width();
			var h = selection.height();
	
			switch (parser) {
				case 'dom-to-image':
					domtoimage.toPng(selection[0])
					.then( function(dataURI) {
						resizeImage(dataURI, w, h)
							.then( function(dataURI) {
								initEditor(dataURI);
							});
					})
					.catch(function (error) {
						console.error('oops, something went wrong!', error);
					});
					break;
	
				case 'html2canvas':
					var viewProportions = 1.2;
					// should be used for mobile only as it needs more parsing tahn domtoimage
					html2canvas(selection, {
						type: 'view',
						width: w * viewProportions,
						height: h * viewProportions,
						background: '#fff',
						//logging: true,
						allowTaint: true
					}).then(function (canvas) {
						var dataURI = canvas.toDataURL('image/png');
						resizeImage(dataURI, w, h).then( function(dataURI) {
							initEditor(dataURI);
						});
					});
					break;
				case 'screenshot':
					navigator.screenshot.URI(function(error,res){
						if (error){
							console.error(error);
						} else {
							crop(res.URI, w, h).then( function(dataURI) {
								initEditor(dataURI);
							});
						}
					}, 90);
					break;
	
				default:
					console.log('No parser');
			}
		}
	
		function crop(dataURI, w, h) {
			var dfd = new $.Deferred();
			var sourceImage = new Image(w, h);
			var scale = 0.5;
				sourceImage.onload = function() {
					// Create a canvas with the desired dimensions
					var canvas = document.createElement('canvas');
				
					var topClip = 150;
					var leftClip = this.naturalWidth-100;
					var bottomClip = this.naturalHeight-topClip-200;
					var resizedW = Math.floor(leftClip * scale);
					var resizedH = Math.floor(bottomClip * scale);
					canvas.width = this.naturalWidth;
					canvas.height = this.naturalHeight;
					canvas.getContext('2d').drawImage(sourceImage, 0, topClip, leftClip, bottomClip, 0, 0, resizedW, resizedH);
					dfd.resolve(canvas.toDataURL());
					sourceImage = null;
				};
				sourceImage.src = dataURI;	
			
			return dfd.promise();
		} 
	
	
		function resizeImage(dataURI, w, h) {
			var dfd = new $.Deferred();
			var sourceImage = new Image(w, h);
	
			sourceImage.onload = function() {
				// Create a canvas with the desired dimensions
				var canvas = document.createElement('canvas');
				canvas.width = this.naturalWidth;
				canvas.height = this.naturalHeight;
		
				// Scale and draw the source image to the canvas
				canvas.getContext('2d').drawImage(sourceImage, 0, 0, w, h);
		
				// Convert the canvas to a data URL in PNG format
				dfd.resolve(canvas.toDataURL());
				sourceImage = null;
			};
		
			sourceImage.src = dataURI;
	
			return dfd.promise();
		}
	
		function getCode(url) {
			return $.ajax({
				url: url,
				async: true,
				dataType: 'text/html',
				success: function (code) {
					return code;
				}
			});
		}
	
		function getSVGfileFromNode(node) {
			var el = $(node);
			var bgImg = el.css('background-image');
			var url = null;
	
			if (bgImg.split('Assets').length > 1) { // temporary fix for bug in ipad url is duplicated
				url = bgImg.substring(4, bgImg.length - 1);
				var a = url.split('/Assets/');
				url = a[1] + '/Assets/' + a[2];
			} else {
				url = bgImg.substring(5, bgImg.length - 2);
			}
			
			var fileName = url.split('/');
				fileName = fileName[fileName.length - 1];
				fileName = fileName.split('.');
			var fileType = fileName[1];
				fileName = fileName[0];
	
			if (fileType === 'svg') {
				var request = $.ajax({
					url: url,
					dataType: 'text',
					success: function (svg) {
						var data = {
							element: el,
							svg: svg,
							url: url,
							fileType: fileType,
							fileName: fileName
						};
						payload.push(data);
					}
				});
	
				promises.push(request);
			}
		}
		
		function showSpinner(el) {
			btnProcessing = true;
			var btn = $(el).find('i');
			btn.removeAttr('class');
			btn.addClass(getClassNameFromSelector(spinningBtnClass));
		}
	
		function hideSpinner(_el) {
			var el = _el ? _el : btnClass;
			var btn = $(el).find('i');
			btn.removeAttr('class');
			btn.addClass(getClassNameFromSelector(openEditorBtnClass));
			btnProcessing = false;
		}
	
	
		function getParsingCanvas() {
			var canvas = document.getElementById(parsingCanvasId);
			if (!canvas) {
				$('body').append('<canvas id="'+parsingCanvasId+'"></canvas>');
				canvas = document.getElementById(parsingCanvasId);
			}
			return canvas;
		}
	
		function setContent(container) {
			var block = getParentBlock(container);
			var primaryIframe = block.find('iframe')[0];
			var tempContent = setTempContentContainer(container);
	
			if (primaryIframe) {
				// parses html into #tempsContent
	
				parseIframes(primaryIframe);
	
				var stage = tempContent.find('#Stage');
	
				stage.find('div').each(function (index, el) {
					getSVGfileFromNode($(el));
				});
	
				$.when.apply(null, promises).done(function () {
					$(payload).each(function (index, response) {
						var el = $(response.element);
	
						var canvas = getParsingCanvas();
	
						/* keep canvas proportions by resizing it to image size */
						canvas.width = el.width();
						canvas.height = el.height();
	
						var svgtext = response.svg.replace("@font-face", ''); // svg bug to settle
	
						// remove inline base64 images as they're not supported for now
						var tempDiv = '<div id="tempDiv"></div>';
						var tmp = $(tempDiv)
						tmp.append(svgtext)
						svgtext = tmp.html();
	
						canvg(parsingCanvasId, svgtext);
						var URI = canvas.toDataURL();
						var img = new Image();
						img.src = URI;
						img.width = el.width();
						img.height = el.height();
						img.id = response.fileName;
	
						el.append(img).css({ background: 'none', transform: 'none' });
						tmp.remove();
						img = null;
					});
					parseContent(tempContent);
				}).always(function () {
					promises = [];
					payload = [];
				});
			} else {
				tempContent = getInnerBlock(container);
	
				parseContent(tempContent);
	
			}
		}
	
		function getInnerBlock(container) {
			var block = getParentBlock(container);
			return block.find(blockInnerClass);
		}
	
		function getInnerBlocks() {
			return $(blockInnerClass);
		}
	
		function getClassNameFromSelector(selector) {
			return selector.replace(/\./g, '');
		}
	
		function scrollIntoView(el) {
			var dfd = new $.Deferred();
		
			if (viewPortEasing) {
				$('html,body').animate({
					scrollTop: $(el).offset().top
				}, 500, function() {
					dfd.resolve();
				});
			} else {
				dfd.resolve();
			}
	
			return dfd.promise();
		}
	
		function setScreenGrabber() {
			var openScreenShotBtn = '<div class="'+getClassNameFromSelector(btnClass)+'" title="Annotate this image"><i class="fa fa-pencil"></i></div>';
			var graphicWidgets = getInnerBlocks();
	
			graphicWidgets.each( function () {
				var block = getParentBlock(this);
				var el = block.find(screenGrabberBtnContainer);
				var progressTrackingTopPosition = el.find(screenGrabberPositionElem).css('top');
				el.append(openScreenShotBtn);
	
				var btn = el.find(btnClass);
				var showHide = (device === 'desktop' || deviceOrientation === 'landscape') ? true : false; 
	
				btn.css({ top: progressTrackingTopPosition}).toggle(showHide);		
	
				btn.on('mouseup', function (e) {
					e.stopPropagation();
					if (btnProcessing) return; // prevents click too fast bug
					
					var target = e.currentTarget;
					showSpinner(target);
							
					scrollIntoView(block).then( function() {
						addAnchor(target);
						setContent(target);
					});
				});
	
				btn.on('editorClosed', function (e) {
					var target = e.currentTarget;
					if (btnIsSpinning(target)) {
						hideSpinner(target);
					}
				});			
			});
		}
	
		function addAnchor(target) {
			var anchor = $('<a name="currentLocation"></a>');
			$(target).parents(blockClass).prepend(anchor[0]);
		}
	
		function btnIsSpinning(el) {
			return $(el).find('i.fa-spin').length;
		}

		init();
	
	})(Zwibbler, html2canvas, domtoimage, canvg);
});