var map = null;

var currentChangesetID = null;
var OSMbaseURL = 'http://api.openstreetmap.org';
var overpassBaseURL = 'http://overpass.osm.rambler.ru/cgi/interpreter';
var autoPOI = false;
var updateLocation = true;

function onBodyLoad() {
    if(window.PhoneGap.available) {
        document.addEventListener("deviceready", function() { init(); }, true);
        document.addEventListener("resume", startWatching, false);
        document.addEventListener("pause", stopWatching, false);
    } else {
        $(function() {
            if(location.href.match(/^http/)) {
                OSMbaseURL = "/osm";
                overpassBaseURL = '/overpass';
            }
            init();
        });
    }
}

document.addEventListener("mobileinit", function() {
    $.mobile.page.prototype.options.backBtnText = "";
}, true);

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

var curPosIconClass = L.Icon.extend({
    iconUrl: "img/curpos.png",
    shadowUrl: null,
    iconSize: new L.Point(40, 40),
    iconAnchor: new L.Point(20, 20)
});
var curPosIcon = new curPosIconClass();
var curPos = null;
var accuracyCircle = null;

function setCurrentPosition(latlng, accuracy) {
    if(updateLocation) {
        console.log("showing position");
        if(curPos || accuracyCircle) {
            map.removeLayer(accuracyCircle);
            console.log('removed layers in add!');
            map.removeLayer(curPos);
        }

        curPos = new L.Marker(latlng, {icon: curPosIcon});
        accuracyCircle  = new L.Circle(latlng, accuracy, {opacity: 0.1, weight: 1, clickable: false});
        map.addLayer(curPos);
        console.log('added layers!');
        map.addLayer(accuracyCircle);
    }

}

var watchID = null;
function startWatching() {
    if(watchID === null) {
        watchID = navigator.geolocation.watchPosition(
                function(pos) {
                    setCurrentPosition(new L.LatLng(pos.coords.latitude, pos.coords.longitude), pos.coords.accuracy);
                }, function(err) {
                    console.log(JSON.stringify(err));
                }, {enableHighAccuracy: true}
            );
    }

}

function stopWatching() {
    navigator.geolocation.clearWatch(watchID);
    watchID = null;
    map.removeLayer(accuracyCircle);
    console.log('removed layers!');
    map.removeLayer(curPos);
}   

function init() {
    $(window).bind('orientationchange pageshow resize', resizeContentArea);
    map = new L.Map('map');

    var tiles = new L.TileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        //attribution: 'Map data &copy; 2011 OpenStreetMap contributors'
        attribution: 'Tiles Courtesy of <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png">. Map data &copy; 2012 OpenStreetMap contributors'
    });


    map.addLayer(tiles);
    map.locateAndSetView(18, {enableHighAccuracy: true});
    map.on('locationfound', function(pos) {
        setCurrentPosition(pos.latlng, pos.accuracy);
    });
    resizeContentArea();

    startWatching();

    map.on('click', function(event) {
        if(adding) { 
            var name = prompt("Enter name");
            POIManager.createPOI(event.latlng.lat, event.latlng.lng, name);
            stopAdd();
        }
    });
    map.on('moveend', function(event) {
        if(autoPOI) {
            updatePOIs();
        }
        return true;
    });
}

function updatePOIs() {
    var bounds = map.getBounds();
    POIManager.getPOIsInBounds(bounds).done(POIManager.displayPOIs);
};

var adding = false;
function startAdd() {
    adding = true;
}

function stopAdd() {
    adding = false;
}

$(function() {
    $("#add-poi").click(function() {
        startAdd();
    });
    $("#current-location").click(function() {
        map.locateAndSetView(18, {enableHighAccuracy: true});
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
        autoPOI = !autoPOI;
        // UGLY HACKS BAH
        if(autoPOI) {
            $(this).removeClass("ui-btn-hover-a").removeClass("ui-btn-up-a").attr("data-theme", "e").addClass("ui-btn-up-e"); 
            updatePOIs();
        } else {
            $(this).removeClass("ui-btn-hover-e").removeClass("ui-btn-up-e").attr("data-theme", "a").addClass("ui-btn-up-a"); 
        }
        $(this).trigger("create");
    });

    $("#current-location").click(function() {
        updateLocation = !updateLocation;
        // UGLY HACKS BAH
        if(updateLocation) {
            $(this).removeClass("ui-btn-hover-a").removeClass("ui-btn-up-a").attr("data-theme", "e").addClass("ui-btn-up-e"); 
            startWatching();
        } else {
            $(this).removeClass("ui-btn-hover-e").removeClass("ui-btn-up-e").attr("data-theme", "a").addClass("ui-btn-up-a"); 
            stopWatching();
        }
        $(this).trigger("create");
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
