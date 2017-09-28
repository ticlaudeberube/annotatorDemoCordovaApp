requirejs.config({
    baseUrl: 'libraries/batAnnotatorWidget',
    paths: {
        'jquery' : 'jquery.v2'
    },
    'shim': {
        'html2canvas': {
            deps: ['jquery'],
            exports: 'html2canvas'
        },
        'zwibbler': {
            deps: ['jquery'],
            exports: 'Zwibbler'}
        ,
        'domtoimage': {
            deps: ['jquery'],
            exports: 'domtoimage'
        },
        'canvg': {
            deps: ['jquery'],
            exports:  'canvg'
        },
        
    }
});