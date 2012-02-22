var map = null;

var currentChangesetID = null;
var OSMbaseURL = 'http://api.openstreetmap.org';
var overpassBaseURL = 'http://overpass.osm.rambler.ru/cgi/interpreter';
var autoPOI = false;
var updateLocation = true;

function onBodyLoad() {
    if(window.PhoneGap.available) {
        document.addEventListener("deviceready", function() { init(); }, true);
        document.addEventListener("resume", curPosManager.startWatching, false);
        document.addEventListener("pause", curPosManager.stopWatching, false);
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
        curPosManager.showPosition(pos.latlng, pos.accuracy);
    });
    resizeContentArea();

    map.on('click', function(event) {
        if(adding) { 
            if(addMarker === null) {
                 addMarker = new L.Marker(event.latlng, {draggable: true});
                 map.addLayer(addMarker);
                 setButtonText("#add-poi", "Save");
            }
        }
    });
    map.on('moveend', function(event) {
        if(autoPOI) {
            updatePOIs();
        }
        return true;
    });
}

var addMarker = null;

function updatePOIs() {
    var bounds = map.getBounds();
    POIManager.getPOIsInBounds(bounds).done(POIManager.displayPOIMarkers);
};

var adding = false;
function startAdd() {
    adding = true;
    setButtonText("#add-poi", "Touch map to create");
}

function stopAdd() {
    if(addMarker !== null) {
        var name = prompt("Enter name");
        var latlng = addMarker.getLatLng();
        POIManager.createPOI(latlng.lat, latlng.lng, name);
        map.removeLayer(addMarker);
        setButtonText("#add-poi", "Add POI");
        addMarker = null;
    }
    adding = false;
}

// Ugly fucking hack
function setButtonText(button, text) {
    $(button + " .ui-btn-text").text(text);
}

$(function() {
    $("#add-poi").click(function() {
        if(adding) {
            stopAdd();
        } else {
            startAdd();
        }
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
            curPosManager.startWatching();
        } else {
            $(this).removeClass("ui-btn-hover-e").removeClass("ui-btn-up-e").attr("data-theme", "a").addClass("ui-btn-up-a"); 
            curPosManager.stopWatching();
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
