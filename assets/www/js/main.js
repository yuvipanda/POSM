function onBodyLoad() {
    console.log('in on body load');
	document.addEventListener("deviceready", function() { init(); }, true);
}

var map = null;

function init() {
    map = new L.Map('map');

    var tiles = new L.TileLayer('http://otile{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png', {
        maxZoom: 18,
        subdomains: '1234', // for MapQuest tiles
        //attribution: 'Map data &copy; 2011 OpenStreetMap contributors'
        attribution: 'Tiles Courtesy of <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png">. Map data &copy; 2012 OpenStreetMap contributors'
    });

    map.addLayer(tiles);
    map.locateAndSetView(16);
    map.on('locationfound', function() {
        console.log("Location found");
    });
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
                    var marker = new L.Marker(new L.LatLng(poi.lat, poi.lon));
                    marker.bindPopup("<strong>" + poi.tags.name + "</strong>");
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
