function onBodyLoad() {
    if(window.PhoneGap.available) {
        document.addEventListener("deviceready", function() { init(); }, true);
    } else {
        $(function() {
            init();
        });
    }
}

document.addEventListener("mobileinit", function() {
    $.mobile.page.prototype.options.backBtnText = "";
}, true);

var map = null;
var shownNodeIDs = [];
var deleteTags = ['^source$', '^created_by$', '^AND_'];
var OSMbaseURL = 'http://api.openstreetmap.org';

var currentChangesetID = null;

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
    var name = "Not named";
    var $poi = $(poi);
    $poi.find('tag').each(function(i, tag) {
        $tag = $(tag);
        var key = $(tag).attr('k');
        var value = $(tag).attr('v');
        if(key == 'name') {
            name = value;
            console.log('name is: ' + name);
        } else {
            tags.push({'key': key, 'value': value});
        }
    });
    return {
        id: $poi.attr('id'),
        lat: $poi.attr('lat'),
        lon: $poi.attr('lon'),
        name: name,
        tags: tags
    };
}

function showPOI(poi) {
    var template = templates.getTemplate("poi-template");
    $("#poi-content").empty().html(template.render(poi));
    $("#poi-name").html(poi.name || 'No name');
    $.mobile.changePage('#poi-page');
    $("#poi-page").trigger("create");
}

$(function() {
    $("#current-location").click(function() {
        map.locateAndSetView();
    });

    $("#map-page").bind('pageshow', function(page) {
        if(currentChangesetID) {
            $("#logged-out-footer").hide();
            $("#logged-in-footer").show();
        } else {
            $("#logged-in-footer").hide();
            $("#logged-out-footer").show();
        }
    });

    $("#show-poi").click(function() {
        var bounds = map.getBounds();
        var sw = bounds.getSouthWest();
        var nw = bounds.getNorthEast();
        var boundsString = "(" + sw.lat + "," + sw.lng + "," + nw.lat + "," + nw.lng + ")";
        console.log(boundsString);
        $.ajax({
            url: "http://overpass.osm.rambler.ru/cgi/interpreter", 
            data: {
                data: "node" + boundsString + ";out body;"
            },
            dataType: "text",
            success: function(resp) {
                var $x = $($.parseXML(resp)); 
                var elements = $x.find('node'); 
                var pois = $.grep(elements, function(element) {
                    var tags = $(element).find('tag');
                    if(tags.length) {
                        var to_delete = [];
                        tags.each(function(i, tag) {
                            var key = $(tag).attr('k');
                            var value = $(tag).attr('v');
                            $.each(deleteTags, function(i, regex) {
                                if(key.match(new RegExp(regex))) {
                                    to_delete.push(tag);
                                }
                            });
                        });

                        $.each(to_delete, function(i, tag) {
                            $(tag).remove();
                        });
                    }
                    console.log(element);
                    return $(element).find('tag').length && ($.inArray(element.id, shownNodeIDs) == -1); 
                });
                $.each(pois, function(i, poi) {
                    var poiData = convertForDisplay(poi);
                    var point = new L.LatLng(poiData.lat, poiData.lon);
                    var marker = new L.Marker(point);
                    var popup = new L.Popup({offset: new L.Point(0, -20)}, poi);
                    var popupContent = $("<div><strong>" + poiData.name + "</strong></div>").click(function() {
                        showPOI(poiData);
                        map.openPopup(popup);
                    })[0];
                    popup.setLatLng(point);
                    popup.setContent(popupContent);
                    marker.on('click', function() {
                        map.openPopup(popup);
                    });
                    map.addLayer(marker);
                    shownNodeIDs.push(poiData.id);
                });
            },
            error: function(err) {
                console.log("WAH WAH");
                console.log(JSON.parse(err.responseText));
            }
        });
    });

    $("#login").click(function() {
        $("#login-user-id").val(localStorage.userName);
        // Death by electrocution and a thousand hours of using PHP 3
        $("#login-password").val(localStorage.password);
        $.mobile.changePage("#login-dialog");
    });
    $("#save-login").click(function() {
        localStorage.userName = $("#login-user-id").val();
        localStorage.password = $("#login-password").val();
        $.mobile.showPageLoadingMsg();
        $.ajax({
            url: OSMbaseURL + '/api/0.6/changeset/create',
            type: 'POST',
            // Need a way to properly do this, but bah
            data: "<osm><changeset><tag k='created_by' v='POIOISM' /><tag k='comment' v='testing' /></changeset></osm>",
            beforeSend: function(xhr) {
                xhr.setRequestHeader("X_HTTP_METHOD_OVERRIDE", "PUT");
                xhr.setRequestHeader("Authorization", "Basic " + btoa(localStorage.userName + ":" + localStorage.password));
            },
            success: function(resp) {
                currentChangesetID = resp;
                console.log(resp);
                $.mobile.hidePageLoadingMsg();
                history.back();
            },
            error: function(err) {
                console.log("error :(");
                console.log(JSON.stringify(err));
                $.mobile.hidePageLoadingMsg();
                alert('Wrong Password!');
            }
        });
    });
});
