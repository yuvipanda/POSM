function onBodyLoad() {
    console.log('in on body load');
	document.addEventListener("deviceready", function() { init(); }, true);
}

var map = null;
function resizeContentArea() {
    var content, contentHeight, footer, header, viewportHeight;
    window.scroll(0, 0);
    header = $(":jqmData(role='header'):visible");
    footer = $(":jqmData(role='footer'):visible");
    content = $(":jqmData(role='content'):visible");
    viewportHeight = $(window).height();
    contentHeight = viewportHeight - header.outerHeight() - footer.outerHeight();
    $("article:jqmData(role='content')").first().height(contentHeight);
    return $("#map").height(contentHeight);
  };

function init() {
    $(window).bind('orientationchange pageshow resize', resizeContentArea);
    map = new L.Map('map');

    var tiles = new L.TileLayer('http://otile{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png', {
        maxZoom: 18,
        subdomains: '1234', // for MapQuest tiles
        //attribution: 'Map data &copy; 2011 OpenStreetMap contributors'
        attribution: 'Tiles Courtesy of <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png">. Map data &copy; 2012 OpenStreetMap contributors'
    });

    map.addLayer(tiles);
    map.locateAndSetView(18, {enableHighAccuracy: true});
    map.on('locationfound', function() {
        console.log("Location found");
    });
    resizeContentArea();
}

function convertForDisplay(poi) {
    var tags = [];
    $.each(poi.tags, function(key, value) {
        tags.push({'key': key, 'value': value});
    });
    return {
        id: poi.id,
        lat: poi.lat,
        lon: poi.lon,
        tags: tags
    };
}

function showPOI(poi) {
    var template = templates.getTemplate("poi-template");
    $("#poi-content").empty().html(template.render(convertForDisplay(poi))).trigger('create');
    $.mobile.changePage('#poi-page');
}

$(function() {
    $("#show-poi").click(function() {
        var bounds = map.getBounds();
        var sw = bounds.getSouthWest();
        var nw = bounds.getNorthEast();
        var boundsString = "(" + sw.lat + "," + sw.lng + "," + nw.lat + "," + nw.lng + ")";
        console.log(boundsString);
        $.ajax({
            url: "http://overpass.osm.rambler.ru/cgi/interpreter", 
            data: {
                data: "[out:json];node" + boundsString + ";out body;"
            },
            dataType: "text",
            success: function(resp) {
                // Stupid bug in their API produces invalid JSON
                // Emailed them about it, told me a fix is coming
                // Till then
                resp = resp.replace(/\\:/g, ':');
                var data = JSON.parse(resp);
                var elements = data.elements;
                var pois = elements.filter(function(element) {
                    if(element.tags) {
                        delete element.tags.source;
                        if($.isEmptyObject(element.tags)) {
                            delete element.tags;
                        }
                    }
                    return element.tags;
                });
                $.each(pois, function(i, poi) {
                    var point = new L.LatLng(poi.lat, poi.lon);
                    var marker = new L.Marker(point);
                    var popup = new L.Popup({offset: new L.Point(0, -20)}, poi);
                    popup.setLatLng(point);
                    popup.setContent("<strong>" + poi.tags.name + "</strong>");
                    marker.on('click', function() {
                        showPOI(poi);
                        map.openPopup(popup);
                    });
                    popup.on('click', function() {
                    });
                    map.addLayer(marker);
                });
            },
            error: function(err) {
                console.log("WAH WAH");
                console.log(JSON.parse(err.responseText));
            }
        });
    });
});
