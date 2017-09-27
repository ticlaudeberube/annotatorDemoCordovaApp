define(['jquery', 'html2canvas', 'Zwibbler', 'domtoimage', 'canvg'], function() {
	'use strict';
	(function (Zwibbler, html2canvas, domtoimage, canvg) {
		var parser = null;
		var promises = [];
		var payload = [];
		var btnClass = '.dynamicCommentor';
		var spinningBtnClass = '.fa-spinner .fa-spin';
		var openEditorBtnClass = '.fa-pencil';
		var hostName = '.batraining.com';
		var tmpContentClass = '.tempContent';
		var blockClass = '.block';
		var blockTmpContentClass =  blockClass +' '+ tmpContentClass;
		var blockInnerClass = '.block-inner';
		var editorId = 'editor';
		var editorIdSelector = '#'+editorId;
		var editorLoaderId = '#editorWorking';
		var editorCanvasName = 'editorCanvas';
		var parsingCanvasId = 'parsingCanvas';
		var useScreenshot = true;
		var deviceOrientation = null;
		var device = null;
		var imageProportions = window.devicePixelRatio ? 0.85 :  1;
		var btnProcessing = null;
		var viewPortEasing = isMobile() ? true : false;

		function init(defaultParser) {
			device = isMobile() ? 'mobile' : 'desktop';
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

			// TODO: remove or use as a back-up
			if (!defaultParser && navigator.screenshot && useScreenshot) {
				//screenshot takes the whole viewport
				parser = 'screenshot';
			}
			
			setScreenGrabber();
		}

		function isMobile() {
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

			// removes hypothesis-adder in iframes
			var adder = div.getElementsByTagName('hypothesis-adder');
			var j = adder.length;
			while (j--) {
				adder[j].parentNode.removeChild(adder[j]);
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

		function editorWorking(show, message, result) {
			var loader = $(editorLoaderId);
			var messageBox = loader.find('.message').removeClass('success');
			message ? messageBox.html('').text(message).append('<i class="fa fa-spinner fa-spin">') 
				: messageBox.html().remove();
			show ? loader.removeClass('hidden') : message ? showMessageAndHide(loader, message, result) 
				: loader.addClass('hidden');
		}

		function showMessageAndHide(loader, message, result) {
			if (result) {
				loader.find('.message').text(message).addClass('success').append('<i class="fa fa-check"></i>');
			}
			setTimeout(function () {
				loader.addClass('hidden');
			}, 2000);
		}

		function initEditor(dataURI) {

			var page = $('.page');
			var html = '<div id="'+editorId+'" class="loading"></div>';
			page.append(html).css({ position: 'relative' });

			var editor = page.find(editorIdSelector);
			editor.append('<div id="'+editorCanvasName+'"></div>');
			editor.append('<div id="editorWorking" class="hidden"><div class="message"></div></div>');
			
			editor.append('<i id="editor-remove" class="editor-btn editor-remove-btn fa fa-times"></i>');
			editor.find('#editor-remove').on('click', function () {
				removeTempContents();
				$(btnClass).trigger('editorClosed');
				$(this).parent().remove();
			});

			if (isMobile()) {
				editor.append('<i id="editor-save" class="editor-btn editor-save-btn fa fa-download"></i>');
				$('#editor-save').on('click', function () {
					var saved = ctx.save('png');
					window.open(saved);
					// send saved document to database.
				});

				if(navigator.screenshot) {
					editor.append('<i id="editor-viewport" class="editor-btn editor-screenshot-btn fa fa-desktop"></i>');
					$('#editor-viewport').on('click', function () {
						editor.find('#editor-remove').click();
						window.setTimeout( function() {
							navigator.screenshot.URI(function(error,res){
								if (error){
									console.error(error);
								} else {
									resizeImage(res.URI,  $(window).width() * imageProportions, $(window).height() * imageProportions, initEditor);
								}
							},1000);
						});
					});
				}
			} else {
				editor.append('<i id="editor-download" class="editor-btn editor-download-btn fa fa-download"></i>');
				$('#editor-download').on('click', function () {
					var filename = prompt('Please enter a filename');
					if (filename) {
						ctx.download('png', filename + '.png');
					}
				});
			}
			
			var ctx = Zwibbler.create(editorCanvasName, {
				showToolbar: true,
				showColourPanel: true,
				scrollbars: false,
				showDebug: false,
				backgroundImage: dataURI
			});

			ctx.on('document-changed', function() {
				$(editorIdSelector).removeClass('loading');
			});
		}

		function parseContent(selection) {
			switch (parser) {
				case 'dom-to-image':
					domtoimage.toPng(selection[0])
						.then(function (dataURI) {
							resizeImage(dataURI, selection.width(), selection.height(), initEditor);
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
						width: selection.width() * viewProportions,
						height: selection.height() * viewProportions,
						background: '#fff',
						//logging: true,
						allowTaint: true
					}).then(function (canvas) {
						var dataURI = canvas.toDataURL('image/png');
						resizeImage(dataURI, selection.width() * imageProportions, selection.height() * imageProportions, initEditor);
					});
					break;

				default:
					console.log('No parser');
			}
		}

		function resizeImage(dataURI, width, height, callback) {
			var sourceImage = new Image();
		
			sourceImage.onload = function() {
				// Create a canvas with the desired dimensions
				var canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
		
				// Scale and draw the source image to the canvas
				canvas.getContext('2d').drawImage(sourceImage, 0, 0, width, height);
		
				// Convert the canvas to a data URL in PNG format
				callback(canvas.toDataURL());
				sourceImage = null;
			};
		
			sourceImage.src = dataURI;
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
			btn.removeClass(getClassNameFromSelector(openEditorBtnClass));
			btn.addClass(getClassNameFromSelector(spinningBtnClass));
		}

		function hideSpinner(el) {
			var btn = $(el).find('i');
			btn.removeClass(getClassNameFromSelector(spinningBtnClass));
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

			graphicWidgets.one('mouseenter', function (e) {
				e.stopPropagation();
				var block = getParentBlock(this);
				var el = block.find('.progressTracking-inner');
				var progressTrackingTopPosition = el.find('.progressTracking-icon').css('top');
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

		function btnIsSpinning(el) {
			return $(el).find('i.fa-spin').length;
		}

		init();

	})(Zwibbler, html2canvas, domtoimage, canvg);
});